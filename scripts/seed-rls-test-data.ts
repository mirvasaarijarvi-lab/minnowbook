/**
 * Seed two tenants + two users for the cross-tenant RLS live-mode tests.
 *
 * Designed to run against a LOCAL Supabase stack started by the Supabase CLI
 * (`supabase start`) inside CI. It uses the service-role key to create users
 * (auto-confirmed) and then signs in as each user to invoke the
 * `public.create_tenant` RPC, which is the only supported way to register
 * a new tenant + tenant_users row from a regular user session.
 *
 * Output: writes `KEY=VALUE` lines to stdout that can be appended to
 * $GITHUB_ENV so the subsequent `vitest` step picks up the live-mode creds.
 *
 * Required env vars:
 *   SUPABASE_URL                 — local stack URL (default http://127.0.0.1:54321)
 *   SUPABASE_ANON_KEY            — local anon key from `supabase status`
 *   SUPABASE_SERVICE_ROLE_KEY    — local service-role key from `supabase status`
 *
 * Idempotent: if the users already exist (re-run on the same DB), the script
 * signs in instead of recreating, and re-uses the existing tenant.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY — run `supabase status` and export both.",
  );
  process.exit(1);
}

interface SeededTenant {
  email: string;
  password: string;
  tenantId: string;
}

const TENANTS = [
  {
    label: "A",
    email: "rls-test-a@mimmobook.local",
    password: "RlsTestPasswordA!2099",
    tenantName: "RLS Test Tenant A",
    tenantSlug: "rls-test-tenant-a",
  },
  {
    label: "B",
    email: "rls-test-b@mimmobook.local",
    password: "RlsTestPasswordB!2099",
    tenantName: "RLS Test Tenant B",
    tenantSlug: "rls-test-tenant-b",
  },
] as const;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Lightweight timing helper. Logs `[seed] <label> <outcome> in Xms` to
 * stderr (so it never pollutes the env-var KEY=VALUE stdout consumed by
 * `$GITHUB_ENV`). Marks anything over `slowMs` with a `[SLOW]` prefix so
 * a flaky local Supabase startup or unapplied migration shows up
 * obviously in CI logs instead of just inflating wall-clock time.
 */
async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  slowMs = 1500,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    const elapsed = Date.now() - startedAt;
    const prefix = elapsed > slowMs ? "[seed][SLOW]" : "[seed]";
    console.error(`${prefix} ${label} ok in ${elapsed}ms`);
    return result;
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    console.error(
      `[seed][FAIL] ${label} failed after ${elapsed}ms: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
}

/**
 * Create or fetch an auth user via the admin API. Auto-confirms the email so
 * the subsequent password sign-in succeeds without an email round trip.
 */
async function ensureUser(email: string, password: string): Promise<string> {
  // Check existing users (paginate up to a few pages — local DB is small)
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await timed(`listUsers page=${page}`, () =>
      admin.auth.admin.listUsers({ page, perPage: 200 }),
    );
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break;
  }

  const { data, error } = await timed(`createUser ${email}`, () =>
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    }),
  );
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  if (!data.user) throw new Error(`createUser(${email}) returned no user`);
  return data.user.id;
}

/**
 * Sign in as the given user and create their tenant via the public RPC.
 * If the user already has a tenant_users row, re-uses it instead.
 */
async function ensureTenant(
  userClient: SupabaseClient,
  userId: string,
  tenantName: string,
  tenantSlug: string,
): Promise<string> {
  // Look up existing membership via service role (bypasses RLS) so we don't
  // create a duplicate tenant on re-runs.
  const { data: existing, error: lookupError } = await timed(
    `tenant_users lookup user=${userId.slice(0, 8)}…`,
    () =>
      admin
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle(),
  );
  if (lookupError) throw new Error(`tenant_users lookup failed: ${lookupError.message}`);
  if (existing?.tenant_id) return existing.tenant_id as string;

  // Create via the public RPC, which enforces the same path real users hit.
  const { data, error } = await timed(`create_tenant rpc slug=${tenantSlug}`, () =>
    userClient.rpc("create_tenant", {
      p_name: tenantName,
      p_slug: tenantSlug,
      p_tier: "business",
    }),
  );
  if (error) throw new Error(`create_tenant(${tenantSlug}) failed: ${error.message}`);
  if (!data) throw new Error(`create_tenant(${tenantSlug}) returned no id`);
  return data as string;
}

async function seedOne(spec: (typeof TENANTS)[number]): Promise<SeededTenant> {
  const userId = await ensureUser(spec.email, spec.password);

  // Use a fresh anon-key client per user so we never carry sessions over.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: spec.email,
    password: spec.password,
  });
  if (signInError)
    throw new Error(`sign-in for ${spec.email} failed: ${signInError.message}`);

  const tenantId = await ensureTenant(
    userClient,
    userId,
    spec.tenantName,
    spec.tenantSlug,
  );

  return { email: spec.email, password: spec.password, tenantId };
}

(async () => {
  const seeded: Record<"A" | "B", SeededTenant> = {} as never;
  for (const spec of TENANTS) {
    try {
      seeded[spec.label] = await seedOne(spec);
      console.error(`[seed] ${spec.label}: ${spec.email} → tenant ${seeded[spec.label].tenantId}`);
    } catch (err) {
      console.error(`[seed] FAILED for tenant ${spec.label}:`, err);
      process.exit(1);
    }
  }

  // Emit env-var lines on stdout so callers can pipe to $GITHUB_ENV.
  const out: string[] = [];
  out.push(`RLS_TEST_TENANT_A_EMAIL=${seeded.A.email}`);
  out.push(`RLS_TEST_TENANT_A_PASSWORD=${seeded.A.password}`);
  out.push(`RLS_TEST_TENANT_A_ID=${seeded.A.tenantId}`);
  out.push(`RLS_TEST_TENANT_B_EMAIL=${seeded.B.email}`);
  out.push(`RLS_TEST_TENANT_B_PASSWORD=${seeded.B.password}`);
  out.push(`RLS_TEST_TENANT_B_ID=${seeded.B.tenantId}`);
  process.stdout.write(out.join("\n") + "\n");
})();
