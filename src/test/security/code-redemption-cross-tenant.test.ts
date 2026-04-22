import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import {
  createAccessCodeTracker,
  type AccessCodeTracker,
} from "./fixtures/access-code-cleanup";

/**
 * Stable, unique tag stamped into every seeded code's `description`.
 * Used by the cleanup helper to recover from prior crashed runs whose
 * UUIDs were lost when the test process died mid-race.
 */
const DESCRIPTION_TAG = "[xtenant-test]";

/**
 * Cross-tenant authenticated redemption test for `redeem-access-code`.
 *
 * Scenario — explicit threat model:
 *
 *   1. A platform operator (system admin) mints a fresh access code that is
 *      conceptually "intended" for tenant A. NB: access codes are NOT
 *      bound to a specific tenant in the schema — any authenticated user
 *      with a workspace can attempt to redeem ANY code. The "for tenant A"
 *      framing just describes intent: in practice, tenant B has somehow
 *      learned the plaintext (phishing, leaked URL, social engineering,
 *      shoulder-surf at a conference, etc.) and tries to use it from
 *      their own logged-in session.
 *
 *   2. A user authenticated AS tenant B's owner POSTs to
 *      `redeem-access-code` with that plaintext. The function must:
 *
 *        a. Apply the redemption ONLY to the redeemer's own tenant
 *           (tenant B), since the user_id → tenant_id resolution is
 *           server-side and cannot be spoofed by the caller.
 *        b. Never create a redemption row attributed to tenant A.
 *        c. Never modify tenant A's tier, sample window, or subscription.
 *
 *   3. The contract under test is: a successful redeem from tenant B's
 *      session UPGRADES TENANT B (and only tenant B); a SECOND attempt
 *      to use the same code from tenant A's session afterwards must be
 *      rejected with the generic INVALID_OR_UNAVAILABLE_CODE because
 *      `max_uses=1` is exhausted — proving tenant A cannot "reclaim"
 *      their own intended code once tenant B has burned it. The error
 *      stays generic so an attacker can't classify codes by status.
 *
 *   4. Audit invariants checked from a neutral standpoint (service role,
 *      bypassing RLS) so we see the raw ledger state, not whatever any
 *      single tenant member would see through their RLS view:
 *
 *        - Exactly 1 row exists in `access_code_redemptions` for the
 *          seeded code, and its `tenant_id` equals tenant B.
 *        - ZERO rows exist with `tenant_id = tenant A`.
 *        - The code's `used_count` is exactly 1 (no double-counting).
 *        - Tenant A's tier/sample fields are unchanged from the
 *          pre-test baseline.
 *        - Tenant B's tier was upgraded to the granted tier.
 *
 * This complements:
 *   - `code-redemption-authenticated-replay.test.ts` (single-redeem +
 *     non-leaking replay for the SAME tenant)
 *   - `code-redemption-authorized-concurrency.test.ts` (parallel races
 *     for one tenant)
 *
 * by adding the cross-tenant axis: even if a different tenant's user
 * presents the code, the side effects must land on THEIR tenant — never
 * on the "intended" tenant — and the ledger must reflect that.
 *
 * Skip behaviour: opt-in. Requires `SUPABASE_SERVICE_ROLE_KEY` so we
 * can provision two throwaway tenants + owners, seed an access code,
 * and audit the ledger neutrally. Without it, the suite skips cleanly
 * and only the gating sanity check runs.
 *
 * Never run against production — fixtures use the `.local` TLD and a
 * dedicated `xtenant-redeem-` prefix so collisions are impossible.
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

const FIXTURE_A_EMAIL = "xtenant-redeem-owner-a@mimmobook.local";
const FIXTURE_A_PASSWORD = "XTenantRedeemOwnerAPassword!2099";
const FIXTURE_A_TENANT_NAME = "Cross-Tenant Redeem Tenant A";
const FIXTURE_A_TENANT_SLUG = "xtenant-redeem-tenant-a";

const FIXTURE_B_EMAIL = "xtenant-redeem-owner-b@mimmobook.local";
const FIXTURE_B_PASSWORD = "XTenantRedeemOwnerBPassword!2099";
const FIXTURE_B_TENANT_NAME = "Cross-Tenant Redeem Tenant B";
const FIXTURE_B_TENANT_SLUG = "xtenant-redeem-tenant-b";

const liveModeAvailable = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY missing — cross-tenant redeem test is opt-in";
  }
  return "ok";
}

/** SHA-256 of canonical access-code form. Mirrors `lookup_access_code_by_plaintext`. */
function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim().toUpperCase()).digest("hex");
}

function freshPlaintext(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `XTNT-${suffix}`;
}

interface FixtureOwner {
  email: string;
  password: string;
  tenantName: string;
  tenantSlug: string;
}

const FIXTURE_A: FixtureOwner = {
  email: FIXTURE_A_EMAIL,
  password: FIXTURE_A_PASSWORD,
  tenantName: FIXTURE_A_TENANT_NAME,
  tenantSlug: FIXTURE_A_TENANT_SLUG,
};
const FIXTURE_B: FixtureOwner = {
  email: FIXTURE_B_EMAIL,
  password: FIXTURE_B_PASSWORD,
  tenantName: FIXTURE_B_TENANT_NAME,
  tenantSlug: FIXTURE_B_TENANT_SLUG,
};

/**
 * Idempotently provision a fixture user + their workspace. Re-runs reuse
 * the existing user/tenant so this is safe to run repeatedly in CI.
 */
async function ensureFixtureUser(
  admin: SupabaseClient,
  spec: FixtureOwner,
): Promise<{ userId: string; tenantId: string }> {
  let userId: string | null = null;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data.users as Array<{ id: string; email?: string }>;
    const found = users.find(
      (u) => u.email?.toLowerCase() === spec.email.toLowerCase(),
    );
    if (found) {
      userId = found.id;
      break;
    }
    if (users.length < 200) break;
  }
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser(${spec.email}) failed: ${error.message}`);
    if (!data.user) throw new Error(`createUser(${spec.email}) returned no user`);
    userId = data.user.id;
  }

  const { data: existingMembership, error: mErr } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw new Error(`tenant_users lookup failed: ${mErr.message}`);
  if (existingMembership?.tenant_id) {
    return { userId, tenantId: existingMembership.tenant_id as string };
  }

  // No tenant yet — create one as the user so create_tenant's auth.uid() check passes.
  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email: spec.email,
    password: spec.password,
  });
  if (signInErr) {
    throw new Error(`fixture sign-in (${spec.email}) failed: ${signInErr.message}`);
  }
  const { data: tenantId, error: rpcErr } = await userClient.rpc("create_tenant", {
    p_name: spec.tenantName,
    p_slug: spec.tenantSlug,
    p_tier: "basic",
  });
  if (rpcErr) {
    throw new Error(`create_tenant(${spec.tenantSlug}) failed: ${rpcErr.message}`);
  }
  if (!tenantId) throw new Error(`create_tenant(${spec.tenantSlug}) returned no id`);
  return { userId, tenantId: tenantId as string };
}

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
      description:
        "Cross-tenant redeem test — auto-cleaned. Code MUST land on the redeemer's tenant, never the 'intended' one.",
      tier: "business",
      duration_days: 14,
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

async function signInAndGetToken(spec: FixtureOwner): Promise<string> {
  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.signInWithPassword({
    email: spec.email,
    password: spec.password,
  });
  if (error) throw new Error(`sign-in (${spec.email}) failed: ${error.message}`);
  if (!data.session?.access_token) {
    throw new Error(`sign-in (${spec.email}) returned no access token`);
  }
  return data.session.access_token;
}

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

async function resetTenantBaseline(
  admin: SupabaseClient,
  tenantId: string,
): Promise<{ tier: string; sample_start_date: string | null; sample_end_date: string | null; subscription_status: string | null }> {
  await admin
    .from("tenants")
    .update({
      tier: "basic",
      sample_start_date: null,
      sample_end_date: null,
      subscription_status: "trialing",
    })
    .eq("id", tenantId);
  const { data } = await admin
    .from("tenants")
    .select("tier, sample_start_date, sample_end_date, subscription_status")
    .eq("id", tenantId)
    .single();
  return {
    tier: (data?.tier as string) ?? "basic",
    sample_start_date: (data?.sample_start_date as string | null) ?? null,
    sample_end_date: (data?.sample_end_date as string | null) ?? null,
    subscription_status: (data?.subscription_status as string | null) ?? null,
  };
}

const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `redeem-access-code — cross-tenant authenticated redemption (live mode: ${skipReason()})`,
  () => {
    let admin: SupabaseClient;
    let userIdA: string;
    let userIdB: string;
    let tenantIdA: string;
    let tenantIdB: string;
    /** Codes seeded by this suite — afterAll cleans them up. */
    const seededCodeIds: string[] = [];

    beforeAll(async () => {
      admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const a = await ensureFixtureUser(admin, FIXTURE_A);
      const b = await ensureFixtureUser(admin, FIXTURE_B);
      userIdA = a.userId;
      tenantIdA = a.tenantId;
      userIdB = b.userId;
      tenantIdB = b.tenantId;

      // Defensive: the fixtures must be DIFFERENT tenants. If they
      // accidentally collapsed to the same tenant_id, the test is
      // meaningless — fail loudly.
      if (tenantIdA === tenantIdB) {
        throw new Error(
          `Fixture invariant broken: tenant A and B resolved to the same id ${tenantIdA}. ` +
            `Check the tenant_users table for cross-fixture leakage.`,
        );
      }
    }, 60_000);

    afterAll(async () => {
      if (!admin) return;
      for (const id of seededCodeIds) {
        await admin.from("access_code_redemptions").delete().eq("access_code_id", id);
        await admin.from("access_codes").delete().eq("id", id);
      }
      // Reset both tenants to a clean baseline so subsequent test runs
      // (and unrelated suites that share the fixture users) start fresh.
      for (const id of [tenantIdA, tenantIdB].filter(Boolean)) {
        await admin
          .from("tenants")
          .update({
            tier: "basic",
            sample_start_date: null,
            sample_end_date: null,
            subscription_status: "trialing",
          })
          .eq("id", id);
      }
    }, 30_000);

    it("redeeming a code 'intended for tenant A' while authenticated as tenant B applies ONLY to tenant B and never writes a tenant-A row", async () => {
      const plaintext = freshPlaintext();
      // Seed the code with tenant A's owner as `created_by`. This mirrors
      // the realistic "the operator generated this for tenant A" intent.
      // The schema does NOT bind the code to tenant A — we're testing
      // that even with that intent, the side effects strictly follow the
      // authenticated caller, never the creator.
      const accessCodeId = await seedAccessCode(admin, plaintext, userIdA);
      seededCodeIds.push(accessCodeId);

      // Pre-test baseline: both tenants on basic, no sample window, no
      // ledger rows for this code. Captured AFTER reset so we can prove
      // tenant A is unchanged at the end.
      const baselineA = await resetTenantBaseline(admin, tenantIdA);
      const baselineB = await resetTenantBaseline(admin, tenantIdB);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("access_code_id", accessCodeId);

      // Sign in as tenant B's owner and redeem the code.
      const tokenB = await signInAndGetToken(FIXTURE_B);
      const res = await callRedeem(tokenB, plaintext);

      expect(
        res.status,
        `tenant B redeem must succeed (got ${res.status}): ${res.rawText}`,
      ).toBe(200);
      const payload = res.body as {
        success?: boolean;
        tier?: string;
        granted_until?: string;
        duration_days?: number;
      };
      expect(payload.success).toBe(true);
      expect(payload.tier).toBe("business");
      expect(payload.duration_days).toBe(14);

      // === Ledger invariants (audited via service role, bypassing RLS) ===

      // 1. There is EXACTLY one redemption for this code overall.
      const { data: allRows, error: allErr } = await admin
        .from("access_code_redemptions")
        .select("id, tenant_id, redeemed_by, granted_tier, granted_until, is_active")
        .eq("access_code_id", accessCodeId);
      expect(allErr, `ledger read failed: ${allErr?.message}`).toBeNull();
      expect(
        allRows?.length,
        `expected exactly 1 ledger row for the code; got ${allRows?.length}`,
      ).toBe(1);

      // 2. That single row belongs to tenant B and is attributed to user B.
      const row = allRows![0];
      expect(
        row.tenant_id,
        `ledger row tenant_id (${row.tenant_id}) must be tenant B (${tenantIdB}), NOT tenant A (${tenantIdA})`,
      ).toBe(tenantIdB);
      expect(row.redeemed_by, "ledger row must be attributed to user B").toBe(userIdB);
      expect(row.granted_tier).toBe("business");
      expect(row.is_active).toBe(true);

      // 3. ZERO rows exist for tenant A — explicit cross-tenant check
      //    using a tenant_id-targeted query rather than relying on the
      //    earlier "exactly 1 row" assertion. If a future bug ever
      //    duplicated the redemption to both tenants, this would catch it
      //    even if `allRows.length === 1` somehow still held.
      const { data: aRows, error: aErr } = await admin
        .from("access_code_redemptions")
        .select("id")
        .eq("access_code_id", accessCodeId)
        .eq("tenant_id", tenantIdA);
      expect(aErr, `tenant-A ledger probe failed: ${aErr?.message}`).toBeNull();
      expect(
        aRows?.length,
        `expected ZERO ledger rows for tenant A; got ${aRows?.length} — cross-tenant leak`,
      ).toBe(0);

      // 4. Code's used_count is exactly 1 (no double-count).
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count, max_uses")
        .eq("id", accessCodeId)
        .single();
      expect(codeRow?.used_count, "used_count must be exactly 1").toBe(1);
      expect(
        (codeRow?.used_count ?? 0) <= (codeRow?.max_uses ?? 0),
        "used_count must never exceed max_uses",
      ).toBe(true);

      // 5. Tenant A is UNCHANGED from baseline — no tier change, no
      //    sample window opened, no subscription_status drift.
      const { data: aTenant } = await admin
        .from("tenants")
        .select("tier, sample_start_date, sample_end_date, subscription_status")
        .eq("id", tenantIdA)
        .single();
      expect(
        aTenant?.tier,
        `tenant A's tier must remain "${baselineA.tier}"; got "${aTenant?.tier}"`,
      ).toBe(baselineA.tier);
      expect(
        aTenant?.sample_start_date ?? null,
        "tenant A's sample_start_date must be untouched",
      ).toBe(baselineA.sample_start_date);
      expect(
        aTenant?.sample_end_date ?? null,
        "tenant A's sample_end_date must be untouched",
      ).toBe(baselineA.sample_end_date);
      expect(
        aTenant?.subscription_status ?? null,
        "tenant A's subscription_status must be untouched",
      ).toBe(baselineA.subscription_status);

      // 6. Tenant B's tier was upgraded as the side effect of THEIR
      //    successful redeem. Sanity-check the granted_until matches
      //    what the response promised.
      const { data: bTenant } = await admin
        .from("tenants")
        .select("tier, sample_end_date, subscription_status")
        .eq("id", tenantIdB)
        .single();
      expect(bTenant?.tier, "tenant B must be upgraded to business").toBe("business");
      expect(bTenant?.sample_end_date).toBe(payload.granted_until);
      expect(
        bTenant?.subscription_status,
        "tenant B's subscription_status must reflect trialing on the granted tier",
      ).toBe("trialing");
      // Reference baselineB so lint/strict-unused doesn't object — and to
      // document that B intentionally MOVED off baseline (unlike A).
      expect(bTenant?.tier).not.toBe(baselineB.tier);
    }, 60_000);

    it("after tenant B has burned the code, tenant A cannot 'reclaim' it — same generic 4xx, ledger still attributed to B", async () => {
      // Setup: seed a fresh code, baseline both tenants, then burn the
      // code from tenant B's session.
      const plaintext = freshPlaintext();
      const accessCodeId = await seedAccessCode(admin, plaintext, userIdA);
      seededCodeIds.push(accessCodeId);

      const baselineA = await resetTenantBaseline(admin, tenantIdA);
      await resetTenantBaseline(admin, tenantIdB);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("access_code_id", accessCodeId);

      const tokenB = await signInAndGetToken(FIXTURE_B);
      const burn = await callRedeem(tokenB, plaintext);
      expect(burn.status, `tenant B burn-redeem must succeed: ${burn.rawText}`).toBe(
        200,
      );

      // Now tenant A's owner — the user the code was conceptually
      // "intended for" — tries to redeem. Must be rejected with the
      // generic INVALID_OR_UNAVAILABLE_CODE because max_uses is exhausted.
      // Crucially, the rejection reason is generic so an attacker holding
      // the code cannot infer "this was already used by someone else".
      const tokenA = await signInAndGetToken(FIXTURE_A);
      const res = await callRedeem(tokenA, plaintext);

      expect(
        res.status,
        `tenant A reclaim must be 4xx (got ${res.status}): ${res.rawText}`,
      ).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(
        bodyCode(res.body),
        `reclaim must collapse to INVALID_OR_UNAVAILABLE_CODE; got "${bodyCode(res.body)}"`,
      ).toBe("INVALID_OR_UNAVAILABLE_CODE");

      // Ledger still has exactly 1 row, still attributed to tenant B.
      // Tenant A still has zero rows for this code.
      const { data: allRows } = await admin
        .from("access_code_redemptions")
        .select("id, tenant_id")
        .eq("access_code_id", accessCodeId);
      expect(
        allRows?.length,
        `reclaim attempt must NOT add a ledger row; got ${allRows?.length}`,
      ).toBe(1);
      expect(allRows![0].tenant_id, "winning ledger row must remain tenant B").toBe(
        tenantIdB,
      );

      const { data: aRows } = await admin
        .from("access_code_redemptions")
        .select("id")
        .eq("access_code_id", accessCodeId)
        .eq("tenant_id", tenantIdA);
      expect(
        aRows?.length,
        `tenant A must STILL have zero ledger rows after reclaim attempt`,
      ).toBe(0);

      // used_count must remain exactly 1 — the failed reclaim cannot
      // bump the counter (otherwise we'd over-decrement quota).
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count")
        .eq("id", accessCodeId)
        .single();
      expect(
        codeRow?.used_count,
        `failed reclaim must not bump used_count; got ${codeRow?.used_count}`,
      ).toBe(1);

      // Tenant A's tier/window are STILL unchanged from baseline — the
      // failed reclaim must be a strict no-op on tenant state.
      const { data: aTenant } = await admin
        .from("tenants")
        .select("tier, sample_start_date, sample_end_date")
        .eq("id", tenantIdA)
        .single();
      expect(aTenant?.tier).toBe(baselineA.tier);
      expect(aTenant?.sample_start_date ?? null).toBe(baselineA.sample_start_date);
      expect(aTenant?.sample_end_date ?? null).toBe(baselineA.sample_end_date);
    }, 60_000);
  },
);

// CI-safe sanity so the file always shows up in the report and the skip
// reason is visible when the live suite is gated off.
describe("cross-tenant authenticated redemption — gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[code-redemption-cross-tenant] live mode skipped: ${skipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
