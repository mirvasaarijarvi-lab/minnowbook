import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import {
  createAccessCodeTracker,
  type AccessCodeTracker,
} from "./fixtures/access-code-cleanup";
import { assertRedeemFunctionReachable } from "./fixtures/redeem-preflight";

/**
 * Stable, unique tag stamped into every seeded code's `description`.
 * Used by the cleanup helper to recover from prior crashed runs whose
 * UUIDs were lost when the test process died mid-race.
 */
const DESCRIPTION_TAG = "[replay-test]";

/**
 * Authenticated single-redeem + replay contract test for `redeem-access-code`.
 *
 * Goal — narrowly verify the user-facing contract requested:
 *
 *   1. An authenticated user with a workspace can redeem a *valid* access
 *      code exactly once. The first call returns 200 with the granted tier
 *      + duration metadata, and the redemption ledger reflects that single
 *      successful redemption.
 *
 *   2. Replaying the SAME code (serially, after the first redeem has
 *      already settled) returns a stable, generic 4xx error with the
 *      `INVALID_OR_UNAVAILABLE_CODE` code. The error must NOT distinguish
 *      between "already redeemed", "not found", "out of uses", "expired",
 *      etc. — that distinction would let an attacker classify codes by
 *      probing.
 *
 *   3. Replays remain stable across multiple repeats — no "drift" where
 *      the second replay accidentally returns a different error code, body
 *      shape, or status. This is the property an enumeration attacker
 *      would exploit if it ever broke.
 *
 *   4. The post-replay state is consistent: the ledger still has exactly
 *      one row; `used_count` is still exactly 1; the tenant tier is still
 *      whatever the successful redeem set it to (replays are no-ops, not
 *      tier resets).
 *
 * This is the *serial* counterpart to `code-redemption-authenticated-e2e.test.ts`
 * (which races N parallel redeems) and `code-redemption-authorized-concurrency.test.ts`
 * (which adds idempotency-key invariants). Together they cover:
 *   - parallel race    → exactly one winner
 *   - serial replay    → stable, non-leaking error          ← THIS FILE
 *   - idempotency-key  → byte-identical cached responses
 *
 * Skip behaviour: opt-in. Requires `SUPABASE_SERVICE_ROLE_KEY` so the
 * suite can provision a throwaway tenant owner, seed an access code with
 * a known plaintext, and audit the ledger from a neutral standpoint
 * (bypassing tenant-member RLS). Without it the suite skips cleanly and
 * the gating sanity check is the only thing that runs.
 *
 * Never run this against a production project — fixtures use a `.local`
 * TLD and a dedicated `replay-redeem-` prefix so collisions are impossible.
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

const FIXTURE_EMAIL = "replay-redeem-owner@mimmobook.local";
const FIXTURE_PASSWORD = "ReplayRedeemOwnerPassword!2099";
const FIXTURE_TENANT_NAME = "Replay Redeem Tenant";
const FIXTURE_TENANT_SLUG = "replay-redeem-tenant";

const liveModeAvailable = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY missing — authenticated replay test is opt-in";
  }
  return "ok";
}

/** SHA-256 of the canonical access-code form. Mirrors `lookup_access_code_by_plaintext`. */
function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim().toUpperCase()).digest("hex");
}

/** Generates a fresh BETA-style plaintext code per test, so seed/cleanup never collides. */
function freshPlaintext(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `BETA-${suffix}`;
}

/**
 * Idempotently provision the fixture user + workspace.
 * Re-runs are safe: an existing user is reused, an existing membership is reused.
 */
async function ensureFixtureUser(admin: SupabaseClient): Promise<{
  userId: string;
  tenantId: string;
}> {
  let userId: string | null = null;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data.users as Array<{ id: string; email?: string }>;
    const found = users.find(
      (u) => u.email?.toLowerCase() === FIXTURE_EMAIL.toLowerCase(),
    );
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

  const { data: existingMembership, error: mErr } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw new Error(`tenant_users lookup failed: ${mErr.message}`);
  if (existingMembership?.tenant_id) {
    return { userId, tenantId: existingMembership.tenant_id as string };
  }

  // No tenant yet — create one as the user (so create_tenant's auth.uid() check passes).
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
      // Description carries the suite tag so `sweepStaleRows()` can
      // recover from a process that died before the in-memory tracker
      // could record this id.
      description: `${DESCRIPTION_TAG} Authenticated single-redeem + replay test — auto-cleaned`,
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

function bodyError(body: unknown): string {
  return ((body as { error?: string } | null)?.error ?? "").toString();
}

const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `redeem-access-code — authenticated single-redeem + non-leaking replay (live mode: ${skipReason()})`,
  () => {
    let admin: SupabaseClient;
    let userId: string;
    let tenantId: string;
    let token: string;
    /**
     * Cleanup tracker — see `fixtures/access-code-cleanup.ts` for the
     * three-layer recovery contract (per-test cleanup + pre-flight sweep
     * by description tag + post-suite belt-and-suspenders sweep).
     */
    let tracker: AccessCodeTracker;

    beforeAll(async () => {
      // Reachability preflight FIRST — surfaces a clear, single-line
      // failure if the function is missing/renamed/misrouted, so we
      // don't waste minutes seeing confusing 404s downstream.
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

      tracker = createAccessCodeTracker({
        admin,
        descriptionTag: DESCRIPTION_TAG,
        fixtureUserId: userId,
        fixtureTenantId: tenantId,
      });

      // PRE-FLIGHT SWEEP: erase any access codes + ledger rows left
      // behind by a previous run that crashed before reaching afterAll.
      await tracker.sweepStaleRows();

      // Reset tenant tier so we can verify the redemption side-effect cleanly.
      await admin
        .from("tenants")
        .update({
          tier: "basic",
          sample_start_date: null,
          sample_end_date: null,
        })
        .eq("id", tenantId);

      token = await signInAndGetToken();
    }, 60_000);

    // Per-test cleanup ensures stale rows never leak between `it()` blocks
    // even if a test throws partway through its assertions.
    afterEach(async () => {
      if (!tracker) return;
      await tracker.cleanupTracked();
    }, 30_000);

    afterAll(async () => {
      if (!admin) return;
      if (tracker) {
        // Run cleanupTracked first (fast, exact) then sweepStaleRows
        // (slow, broad) so even a forgotten `register()` is recovered.
        await tracker.cleanupTracked();
        await tracker.sweepStaleRows();
      }
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

    it("first redemption succeeds with 200, returns granted tier + duration, and writes exactly one ledger row", async () => {
      const plaintext = freshPlaintext();
      const accessCodeId = await seedAccessCode(admin, plaintext, userId);
      tracker.register(accessCodeId);

      // Clean slate for this code.
      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);

      const res = await callRedeem(token, plaintext);

      expect(
        res.status,
        `first redeem must succeed; got ${res.status}: ${res.rawText}`,
      ).toBe(200);
      const payload = res.body as {
        success?: boolean;
        tier?: string;
        granted_until?: string;
        duration_days?: number;
      };
      expect(payload.success).toBe(true);
      expect(payload.tier).toBe("business");
      expect(payload.duration_days).toBe(7);
      expect(typeof payload.granted_until).toBe("string");
      // granted_until is a future date.
      expect(
        new Date(payload.granted_until!).getTime(),
        "granted_until must be in the future",
      ).toBeGreaterThan(Date.now() - 24 * 60 * 60 * 1000);

      // Ledger: exactly one row, attributed to caller.
      const { data: rows } = await admin
        .from("access_code_redemptions")
        .select("id, redeemed_by, granted_tier, granted_until, is_active")
        .eq("access_code_id", accessCodeId)
        .eq("tenant_id", tenantId);
      expect(rows?.length).toBe(1);
      expect(rows![0].redeemed_by).toBe(userId);
      expect(rows![0].granted_tier).toBe("business");
      expect(rows![0].is_active).toBe(true);
      expect(rows![0].granted_until).toBe(payload.granted_until);

      // used_count exactly 1, never exceeding max_uses.
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count, max_uses")
        .eq("id", accessCodeId)
        .single();
      expect(codeRow?.used_count).toBe(1);
      expect((codeRow?.used_count ?? 0) <= (codeRow?.max_uses ?? 0)).toBe(true);

      // Tenant tier upgraded as the side effect of the successful redeem.
      const { data: tenantRow } = await admin
        .from("tenants")
        .select("tier, sample_end_date")
        .eq("id", tenantId)
        .single();
      expect(tenantRow?.tier).toBe("business");
      expect(tenantRow?.sample_end_date).toBe(payload.granted_until);
    }, 60_000);

    it("replaying the same code returns a stable, generic, non-leaking 4xx error", async () => {
      const plaintext = freshPlaintext();
      const accessCodeId = await seedAccessCode(admin, plaintext, userId);
      tracker.register(accessCodeId);

      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);

      // First redeem — establishes the "used" state.
      const first = await callRedeem(token, plaintext);
      expect(first.status, `first redeem must succeed: ${first.rawText}`).toBe(200);

      // Replay 1 — must be a generic INVALID_OR_UNAVAILABLE_CODE 4xx.
      const replay1 = await callRedeem(token, plaintext);
      expect(
        replay1.status,
        `replay must be 4xx (got ${replay1.status}): ${replay1.rawText}`,
      ).toBeGreaterThanOrEqual(400);
      expect(replay1.status).toBeLessThan(500);
      expect(
        bodyCode(replay1.body),
        `replay must collapse to INVALID_OR_UNAVAILABLE_CODE, got "${bodyCode(
          replay1.body,
        )}"`,
      ).toBe("INVALID_OR_UNAVAILABLE_CODE");

      // The error message itself must NOT leak the underlying reason.
      // It must not contain words that would let an attacker distinguish
      // "already redeemed" from "not found" / "expired" / "over quota".
      const msg = bodyError(replay1.body).toLowerCase();
      const leakyTerms = [
        "already",
        "redeemed",
        "exists",
        "expired",
        "exhausted",
        "limit",
        "quota",
        "not found",
        "revoked",
        "inactive",
        "duplicate",
      ];
      for (const term of leakyTerms) {
        expect(
          msg.includes(term),
          `replay error message leaks reason "${term}": "${msg}"`,
        ).toBe(false);
      }

      // Replay 2 + 3 — stability check. The status, body code, and full
      // body text must be identical across repeats. A regression where
      // the function ever drifted (e.g. started returning a different
      // generic code on the third replay) would surface here.
      const replay2 = await callRedeem(token, plaintext);
      const replay3 = await callRedeem(token, plaintext);

      expect(replay2.status, "replay status must be stable").toBe(replay1.status);
      expect(replay3.status, "replay status must be stable").toBe(replay1.status);
      expect(
        bodyCode(replay2.body),
        "replay error code must be stable",
      ).toBe(bodyCode(replay1.body));
      expect(
        bodyCode(replay3.body),
        "replay error code must be stable",
      ).toBe(bodyCode(replay1.body));
      expect(
        replay2.rawText,
        "replay body must be byte-identical across repeats",
      ).toBe(replay1.rawText);
      expect(
        replay3.rawText,
        "replay body must be byte-identical across repeats",
      ).toBe(replay1.rawText);

      // Post-replay state must be unchanged: still exactly one ledger row,
      // still used_count == 1, still on the granted tier. Replays are
      // strictly read-only no-ops.
      const { data: rows } = await admin
        .from("access_code_redemptions")
        .select("id")
        .eq("access_code_id", accessCodeId)
        .eq("tenant_id", tenantId);
      expect(
        rows?.length,
        `replays must not write extra ledger rows; got ${rows?.length}`,
      ).toBe(1);

      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count")
        .eq("id", accessCodeId)
        .single();
      expect(
        codeRow?.used_count,
        `replays must not bump used_count; got ${codeRow?.used_count}`,
      ).toBe(1);

      const { data: tenantRow } = await admin
        .from("tenants")
        .select("tier")
        .eq("id", tenantId)
        .single();
      expect(
        tenantRow?.tier,
        "replays must not reset or change the tenant tier",
      ).toBe("business");
    }, 60_000);

    it("replay error is indistinguishable from a never-existed code (no enumeration signal)", async () => {
      // Seed + redeem one code so it transitions to the "already redeemed"
      // state, then probe with a different code that NEVER existed. The
      // error responses must be byte-identical (status + code + message),
      // proving an attacker cannot tell "this code was real and used" from
      // "this code never existed".
      const usedPlaintext = freshPlaintext();
      const usedId = await seedAccessCode(admin, usedPlaintext, userId);
      tracker.register(usedId);

      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);

      const ok = await callRedeem(token, usedPlaintext);
      expect(ok.status, `setup redeem must succeed: ${ok.rawText}`).toBe(200);

      const usedReplay = await callRedeem(token, usedPlaintext);
      const ghostPlaintext = freshPlaintext(); // never seeded
      const ghost = await callRedeem(token, ghostPlaintext);

      expect(
        usedReplay.status,
        `used-replay status (${usedReplay.status}) must equal ghost-code status (${ghost.status})`,
      ).toBe(ghost.status);
      expect(
        bodyCode(usedReplay.body),
        "used-replay code must equal ghost-code code",
      ).toBe(bodyCode(ghost.body));
      expect(
        bodyError(usedReplay.body),
        "used-replay message must equal ghost-code message — no enumeration signal",
      ).toBe(bodyError(ghost.body));
    }, 60_000);
  },
);

// CI-safe sanity so the file always shows up in the report and the skip
// reason is visible when the live suite is gated off.
describe("authenticated single-redeem + replay — gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[code-redemption-authenticated-replay] live mode skipped: ${skipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
