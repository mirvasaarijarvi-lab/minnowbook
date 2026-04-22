/**
 * Reusable fixture that provides two authenticated Supabase clients, each
 * representing a different tenant, for cross-tenant security tests.
 *
 * Resolution order:
 *
 * 1. **Explicit env vars** — if RLS_TEST_TENANT_A_* and RLS_TEST_TENANT_B_*
 *    are all set, sign in with those credentials. This is what the live
 *    staging-project workflow uses.
 *
 * 2. **Auto-provision via service role** — if SUPABASE_SERVICE_ROLE_KEY is
 *    available (typical for the local-stack CI workflow OR a developer who
 *    exported it locally), the fixture creates two throwaway users + tenants
 *    via `auth.admin.createUser` + the `create_tenant` RPC and signs in as
 *    each. Idempotent: re-runs reuse the same users/tenants.
 *
 * 3. **Skip** — neither path available. The fixture returns `available: false`
 *    with a `skipReason` describing what's missing, and tests use it via
 *    `describe.runIf(fixture.available)` to skip cleanly.
 *
 * The fixture deliberately does NOT throw when credentials are missing —
 * that's a normal CI condition, not an error. It only throws if a path is
 * partially configured (e.g. service role present but RPC fails) so genuine
 * setup bugs surface loudly.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface TenantClient {
  /** Authenticated Supabase client for this tenant's user. */
  client: SupabaseClient;
  /** Tenant UUID this user belongs to. */
  tenantId: string;
  /** Email used to sign in (useful for diagnostics). */
  email: string;
  /** Auth user UUID. */
  userId: string;
}

export interface TenantPairFixture {
  available: boolean;
  /** Human-readable reason this fixture is unavailable, when `available=false`. */
  skipReason?: string;
  /** How the credentials were obtained. */
  source?: "env" | "auto-provisioned";
  a?: TenantClient;
  b?: TenantClient;
}

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ENV_CREDS = {
  a: {
    email: process.env.RLS_TEST_TENANT_A_EMAIL,
    password: process.env.RLS_TEST_TENANT_A_PASSWORD,
    tenantId: process.env.RLS_TEST_TENANT_A_ID,
  },
  b: {
    email: process.env.RLS_TEST_TENANT_B_EMAIL,
    password: process.env.RLS_TEST_TENANT_B_PASSWORD,
    tenantId: process.env.RLS_TEST_TENANT_B_ID,
  },
};

const envCredsComplete = Boolean(
  ENV_CREDS.a.email &&
    ENV_CREDS.a.password &&
    ENV_CREDS.a.tenantId &&
    ENV_CREDS.b.email &&
    ENV_CREDS.b.password &&
    ENV_CREDS.b.tenantId,
);

/**
 * Stable test-fixture user specs. Used only when auto-provisioning. Emails
 * use the `.local` TLD so they can never accidentally match a real account.
 */
const AUTO_SPECS = [
  {
    label: "a" as const,
    email: "rls-fixture-a@mimmobook.local",
    password: "RlsFixturePasswordA!2099",
    tenantName: "RLS Fixture Tenant A",
    tenantSlug: "rls-fixture-tenant-a",
  },
  {
    label: "b" as const,
    email: "rls-fixture-b@mimmobook.local",
    password: "RlsFixturePasswordB!2099",
    tenantName: "RLS Fixture Tenant B",
    tenantSlug: "rls-fixture-tenant-b",
  },
];

function newAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInAsExistingUser(
  email: string,
  password: string,
  expectedTenantId: string,
): Promise<TenantClient> {
  const client = newAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  if (!data.user) throw new Error(`Sign-in for ${email} returned no user`);
  return { client, tenantId: expectedTenantId, email, userId: data.user.id };
}

/**
 * Look up or create an auth user via the admin API. Auto-confirms email so
 * password sign-in works without an email round trip.
 */
async function ensureUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  if (!data.user) throw new Error(`createUser(${email}) returned no user`);
  return data.user.id;
}

/**
 * Look up the user's existing tenant via service role (bypasses RLS) or
 * create one via the public RPC. Idempotent.
 */
async function ensureTenant(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  userId: string,
  tenantName: string,
  tenantSlug: string,
): Promise<string> {
  const { data: existing, error: lookupError } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupError) throw new Error(`tenant_users lookup failed: ${lookupError.message}`);
  if (existing?.tenant_id) return existing.tenant_id as string;

  const { data, error } = await userClient.rpc("create_tenant", {
    p_name: tenantName,
    p_slug: tenantSlug,
    p_tier: "business",
  });
  if (error) throw new Error(`create_tenant(${tenantSlug}) failed: ${error.message}`);
  if (!data) throw new Error(`create_tenant(${tenantSlug}) returned no id`);
  return data as string;
}

async function provisionOne(
  admin: SupabaseClient,
  spec: (typeof AUTO_SPECS)[number],
): Promise<TenantClient> {
  const userId = await ensureUser(admin, spec.email, spec.password);
  const client = newAnonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email: spec.email,
    password: spec.password,
  });
  if (signInError) throw new Error(`Sign-in for ${spec.email} failed: ${signInError.message}`);
  const tenantId = await ensureTenant(admin, client, userId, spec.tenantName, spec.tenantSlug);
  return { client, tenantId, email: spec.email, userId };
}

/**
 * Build the tenant pair fixture. Resolves credentials in priority order:
 * env vars → auto-provision → unavailable.
 *
 * Cache the returned promise across tests in a suite by storing it in a
 * `beforeAll` so we don't re-run sign-in for every `it.each` iteration.
 */
export async function createTenantPairFixture(): Promise<TenantPairFixture> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      available: false,
      skipReason:
        "VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing — required for any RLS test",
    };
  }

  // Path 1: explicit creds
  if (envCredsComplete) {
    try {
      const [a, b] = await Promise.all([
        signInAsExistingUser(ENV_CREDS.a.email!, ENV_CREDS.a.password!, ENV_CREDS.a.tenantId!),
        signInAsExistingUser(ENV_CREDS.b.email!, ENV_CREDS.b.password!, ENV_CREDS.b.tenantId!),
      ]);
      return { available: true, source: "env", a, b };
    } catch (err) {
      // Sign-in with explicit creds failed — surface loudly, don't silently
      // fall back, because that would mask the actual config error.
      throw new Error(
        `Live RLS env vars are set but sign-in failed: ${(err as Error).message}. ` +
          `Verify RLS_TEST_TENANT_A/B credentials match users in this Supabase project.`,
      );
    }
  }

  // Path 2: auto-provision via service role
  if (SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      const [a, b] = await Promise.all([
        provisionOne(admin, AUTO_SPECS[0]),
        provisionOne(admin, AUTO_SPECS[1]),
      ]);
      return { available: true, source: "auto-provisioned", a, b };
    } catch (err) {
      throw new Error(
        `Auto-provisioning RLS test users via service role failed: ${(err as Error).message}. ` +
          `Either fix the underlying issue or unset SUPABASE_SERVICE_ROLE_KEY to skip live mode.`,
      );
    }
  }

  return {
    available: false,
    skipReason:
      "No live-mode credentials available. Either set RLS_TEST_TENANT_A/B_EMAIL/PASSWORD/ID, " +
      "or provide SUPABASE_SERVICE_ROLE_KEY to auto-provision throwaway users on a non-production project.",
  };
}

/**
 * Synchronous probe: returns true when the fixture has *any* viable path.
 * Useful for `describe.runIf(...)` gating without awaiting fixture setup.
 */
export function tenantPairFixtureLikelyAvailable(): boolean {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  return envCredsComplete || Boolean(SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Sync description of why the fixture would be unavailable. Mirrors the
 * runtime `skipReason` so test skip messages are consistent.
 */
export function tenantPairFixtureSkipReason(): string | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (envCredsComplete) return null;
  if (SUPABASE_SERVICE_ROLE_KEY) return null;
  return "no RLS_TEST_TENANT_A/B_* env vars and no SUPABASE_SERVICE_ROLE_KEY";
}
