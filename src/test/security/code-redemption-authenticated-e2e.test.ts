import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { assertRedeemFunctionReachable } from "./fixtures/redeem-preflight";

/**
 * Authenticated end-to-end concurrency test for `redeem-access-code`.
 *
 * Goal — close the only gap left by the existing concurrency suite:
 *   The previous suite can only assert "deterministic-failure stability"
 *   because it has no real session and no valid plaintext code. This suite
 *   does the full happy-path race:
 *
 *     1. Provision (or reuse) a throwaway tenant owner via the service role.
 *     2. Seed a fresh single-use access code with a known plaintext, hashed
 *        the same way the production lookup RPC expects (SHA-256 of the
 *        upper-cased trimmed code).
 *     3. Sign in as the owner.
 *     4. Fire N parallel redeems against the DEPLOYED `redeem-access-code`
 *        edge function with the real plaintext.
 *     5. Assert:
 *        - Exactly one 200 success.
 *        - All other responses are 400 with code INVALID_OR_UNAVAILABLE_CODE
 *          (the deliberately-collapsed "already redeemed / over quota /
 *          not found" payload — no information leakage about which loser
 *          lost why).
 *        - The `access_code_redemptions` ledger has exactly one row for
 *          this (access_code_id, tenant_id) pair.
 *        - `access_codes.used_count` is exactly 1.
 *     6. Replay one more serial redeem and confirm it ALSO fails with the
 *        same generic code — i.e. the post-race state is stable.
 *     7. Cleanup: delete the seeded code + redemption rows so re-runs are
 *        idempotent and we don't accumulate test data on the live project.
 *
 * Skip behaviour — this suite is **opt-in** and skips cleanly without
 * `SUPABASE_SERVICE_ROLE_KEY`, because:
 *   - Provisioning a tenant owner requires admin auth.
 *   - Seeding an access code in the production-shaped table requires
 *     bypassing the system-admin RLS policy on `access_codes`.
 *   - Asserting on the redemption ledger requires bypassing tenant-member
 *     RLS to verify the count is exactly 1 from a neutral standpoint.
 *
 * Never run this against a production project — it writes to `tenants`,
 * `tenant_users`, `access_codes`, and `access_code_redemptions`. The
 * fixture user / tenant slug use the `.local` TLD and a `e2e-redeem-`
 * prefix specifically so they cannot collide with real records.
 */

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FIXTURE_EMAIL = "e2e-redeem-owner@mimmobook.local";
const FIXTURE_PASSWORD = "E2eRedeemOwnerPassword!2099";
const FIXTURE_TENANT_NAME = "E2E Redeem Tenant";
const FIXTURE_TENANT_SLUG = "e2e-redeem-tenant";

/** True when this suite has everything it needs to run for real. */
const liveModeAvailable = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

/** Skip-message string for the Vitest reporter when the suite is gated off. */
function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY missing — authenticated E2E redemption test is opt-in";
  }
  return "ok";
}

/** SHA-256 of the canonical access-code form (uppercased + trimmed). */
function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim().toUpperCase()).digest("hex");
}

/** Generate a fresh plaintext code that conforms to the BETA-XXXXXXXX shape. */
function freshPlaintext(): string {
  // 8 hex chars => fits the existing UI prefix convention and stays well
  // under the 50-char ceiling enforced by the edge function.
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `BETA-${suffix}`;
}

/** Provision (or reuse) the throwaway tenant owner. Returns sign-in creds + IDs. */
async function ensureFixtureUser(admin: SupabaseClient): Promise<{
  userId: string;
  tenantId: string;
}> {
  // Look up existing user
  let userId: string | null = null;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data.users as Array<{ id: string; email?: string }>;
    const found = users.find((u) => u.email?.toLowerCase() === FIXTURE_EMAIL.toLowerCase());
    if (found) {
      userId = found.id;
      break;
    }
    if (users.length < 200) break;
  }
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: FIXTURE_EMAIL,
      password: FIXTURE_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser failed: ${error.message}`);
    if (!data.user) throw new Error("createUser returned no user");
    userId = data.user.id;
  }

  // Look up existing tenant via service role (bypasses RLS)
  const { data: existingMembership, error: mErr } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw new Error(`tenant_users lookup failed: ${mErr.message}`);
  if (existingMembership?.tenant_id) {
    return { userId, tenantId: existingMembership.tenant_id as string };
  }

  // Create one via the public RPC, signed in as the user (mirrors real flow).
  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
  });
  if (signInErr) throw new Error(`fixture sign-in failed: ${signInErr.message}`);
  const { data: tenantId, error: rpcErr } = await userClient.rpc("create_tenant", {
    p_name: FIXTURE_TENANT_NAME,
    p_slug: FIXTURE_TENANT_SLUG,
    p_tier: "basic",
  });
  if (rpcErr) throw new Error(`create_tenant failed: ${rpcErr.message}`);
  if (!tenantId) throw new Error("create_tenant returned no id");
  return { userId, tenantId: tenantId as string };
}

/** Seed a single-use access code for the test. Returns its row id. */
async function seedAccessCode(
  admin: SupabaseClient,
  plaintext: string,
  createdBy: string,
): Promise<string> {
  const { data, error } = await admin
    .from("access_codes")
    .insert({
      code_hash: hashCode(plaintext),
      code_prefix: plaintext.slice(0, 8),
      description: "E2E redeem concurrency test — auto-cleaned",
      tier: "business",
      duration_days: 7,
      max_uses: 1,
      is_active: true,
      is_revoked: false,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(`access_codes insert failed: ${error.message}`);
  if (!data?.id) throw new Error("access_codes insert returned no id");
  return data.id as string;
}

/** Sign in as the fixture user and return their access token. */
async function signInAndGetToken(): Promise<string> {
  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.signInWithPassword({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  if (!data.session?.access_token) throw new Error("no access token returned");
  return data.session.access_token;
}

/** Call the deployed redeem-access-code edge function with the user's token. */
async function callRedeem(token: string, code: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-access-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, rawText: text };
}

function bodyCode(body: unknown): string {
  return ((body as { code?: string } | null)?.code ?? "").toString();
}

const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `redeem-access-code — authenticated end-to-end concurrency (live mode: ${skipReason()})`,
  () => {
    let admin: SupabaseClient;
    let userId: string;
    let tenantId: string;
    let accessCodeId: string | null = null;
    let plaintext: string;
    let token: string;

    beforeAll(async () => {
      // Reachability preflight FIRST — fail fast with a single,
      // copy-pasteable error if the function is missing/misrouted/etc.
      // Doing this before any provisioning saves operators 30+ seconds
      // of "create user → create tenant → seed code → call function →
      // 404 from a renamed function" debugging.
      await assertRedeemFunctionReachable({
        supabaseUrl: SUPABASE_URL!,
        supabasePublishableKey: SUPABASE_ANON_KEY!,
      });

      admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const fixture = await ensureFixtureUser(admin);
      userId = fixture.userId;
      tenantId = fixture.tenantId;

      // Reset tenant tier so prior runs don't leave the tenant on "business"
      // (which would still let the redeem succeed, but masks regressions
      // where the tier-update side-effect stops happening).
      await admin
        .from("tenants")
        .update({
          tier: "basic",
          sample_start_date: null,
          sample_end_date: null,
        })
        .eq("id", tenantId);

      // Wipe any stale redemption rows for this tenant from previous runs so
      // the "exactly 1 row after the race" assertion is meaningful.
      await admin.from("access_code_redemptions").delete().eq("tenant_id", tenantId);

      plaintext = freshPlaintext();
      accessCodeId = await seedAccessCode(admin, plaintext, userId);

      token = await signInAndGetToken();
    }, 60_000);

    afterAll(async () => {
      if (!admin) return;
      // Cleanup in dependency order so FKs (if any) don't block.
      if (accessCodeId) {
        await admin
          .from("access_code_redemptions")
          .delete()
          .eq("access_code_id", accessCodeId);
        await admin.from("access_codes").delete().eq("id", accessCodeId);
      }
      // Reset the tenant's tier so the fixture is in a clean state for re-runs.
      if (tenantId) {
        await admin
          .from("tenants")
          .update({
            tier: "basic",
            sample_start_date: null,
            sample_end_date: null,
          })
          .eq("id", tenantId);
      }
    }, 30_000);

    it("exactly one of 10 parallel redeems succeeds; the rest get the generic invalid-or-unavailable code", async () => {
      const PARALLEL = 10;
      const results = await Promise.all(
        Array.from({ length: PARALLEL }, () => callRedeem(token, plaintext)),
      );

      // 1. Exactly one 200 success.
      const successes = results.filter((r) => r.status === 200);
      const failures = results.filter((r) => r.status !== 200);
      expect(
        successes.length,
        `expected exactly 1 success out of ${PARALLEL}, got ${successes.length}. ` +
          `Successes: ${JSON.stringify(successes.map((s) => s.body))}`,
      ).toBe(1);
      expect(failures.length).toBe(PARALLEL - 1);

      // 2. The successful response carries the granted tier and a granted_until date.
      const ok = successes[0]!.body as {
        success?: boolean;
        tier?: string;
        granted_until?: string;
        duration_days?: number;
      };
      expect(ok.success).toBe(true);
      expect(ok.tier).toBe("business");
      expect(ok.granted_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ok.duration_days).toBe(7);

      // 3. Every loser must be a deterministic 400 with the generic
      //    INVALID_OR_UNAVAILABLE_CODE — never 5xx, never a different code
      //    that would distinguish "already redeemed" from "not found" /
      //    "over quota" (information leakage).
      for (const f of failures) {
        expect(f.status, `loser must be 400, got ${f.status}: ${f.rawText}`).toBe(400);
        const code = bodyCode(f.body);
        expect(
          code,
          `loser must collapse to INVALID_OR_UNAVAILABLE_CODE, got "${code}". ` +
            `Body: ${f.rawText}`,
        ).toBe("INVALID_OR_UNAVAILABLE_CODE");
      }

      // 4. Ledger must reflect exactly one redemption — proves the unique
      //    constraint + per-row "already redeemed" check held under the race.
      const { data: redemptions, error: rErr } = await admin
        .from("access_code_redemptions")
        .select("id, redeemed_by, tenant_id, granted_tier, is_active")
        .eq("access_code_id", accessCodeId!)
        .eq("tenant_id", tenantId);
      expect(rErr, `ledger query error: ${rErr?.message}`).toBeNull();
      expect(
        redemptions?.length,
        `redemption ledger must have exactly 1 row, got ${redemptions?.length}: ` +
          JSON.stringify(redemptions),
      ).toBe(1);
      expect(redemptions![0].redeemed_by).toBe(userId);
      expect(redemptions![0].granted_tier).toBe("business");
      expect(redemptions![0].is_active).toBe(true);

      // 5. used_count must be exactly 1 — proves the optimistic-concurrency
      //    increment didn't double-count even though many calls raced past
      //    the lookup at roughly the same moment.
      const { data: codeRow, error: cErr } = await admin
        .from("access_codes")
        .select("used_count, max_uses")
        .eq("id", accessCodeId!)
        .single();
      expect(cErr, `access_codes query error: ${cErr?.message}`).toBeNull();
      expect(
        codeRow?.used_count,
        `used_count must be exactly 1 after race, got ${codeRow?.used_count}`,
      ).toBe(1);
      expect(codeRow?.max_uses).toBe(1);

      // 6. The tenant's tier must have been upgraded — the success path's
      //    side effect actually persisted, not just the response.
      const { data: tenantRow } = await admin
        .from("tenants")
        .select("tier, sample_end_date")
        .eq("id", tenantId)
        .single();
      expect(tenantRow?.tier).toBe("business");
      expect(tenantRow?.sample_end_date).toBe(ok.granted_until);
    }, 60_000);

    it("a serial replay after the race still fails with the same generic code (no second success ever)", async () => {
      // The race already settled — one success, nine generic 400s. A fresh
      // serial attempt must continue to return the generic 400, NOT a
      // different code (e.g. a leaked "already redeemed" string) and
      // certainly not a second 200.
      const replay = await callRedeem(token, plaintext);
      expect(replay.status).toBe(400);
      expect(bodyCode(replay.body)).toBe("INVALID_OR_UNAVAILABLE_CODE");

      // Ledger must still be exactly 1 row.
      const { data: redemptions } = await admin
        .from("access_code_redemptions")
        .select("id")
        .eq("access_code_id", accessCodeId!)
        .eq("tenant_id", tenantId);
      expect(redemptions?.length).toBe(1);

      // used_count must still be exactly 1.
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count")
        .eq("id", accessCodeId!)
        .single();
      expect(codeRow?.used_count).toBe(1);
    }, 30_000);
  },
);

// CI-safe sanity: even when the suite is skipped, surface ONE always-running
// test so the file shows up in the report and the skip reason is visible.
describe("authenticated E2E redeem concurrency — gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[code-redemption-authenticated-e2e] live mode skipped: ${skipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
