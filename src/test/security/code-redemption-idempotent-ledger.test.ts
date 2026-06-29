import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import {
  createAccessCodeTracker,
  type AccessCodeTracker,
} from "./fixtures/access-code-cleanup";
import { assertRedeemFunctionReachable } from "./fixtures/redeem-preflight";

/**
 * Idempotent-ledger contract for `redeem-access-code`.
 *
 * Targets the narrow invariant:
 *   For ANY authenticated caller, repeated identical redemption attempts
 *   (same code + same `Idempotency-Key`) MUST NEVER increment
 *   `access_codes.used_count` more than once, even when the code has
 *   spare capacity (`max_uses > 1`).
 *
 * The existing replay / concurrency suites cover the `max_uses = 1`
 * case (because "already redeemed by this tenant" naturally short-
 * circuits any second write). This file deliberately uses `max_uses = 3`
 * so a regression that double-spent on retries would surface as
 * `used_count > 1`, NOT as a tenant-uniqueness rejection.
 *
 * Two flavours:
 *   1. Serial replays — 8 sequential calls with the same key.
 *   2. Parallel replays — 12 concurrent calls with the same key.
 *
 * Both must end with `used_count === 1` and exactly one ledger row,
 * and every call must return a byte-identical response. A second,
 * DIFFERENT idempotency key from the same caller must still be
 * rejected as `INVALID_OR_UNAVAILABLE_CODE` (tenant already redeemed),
 * proving the cache layer never opens a new write path.
 *
 * Live mode is opt-in via `SUPABASE_SERVICE_ROLE_KEY` so the suite is
 * a no-op in pure unit-test CI runs and only fires when the operator
 * deliberately points it at a staging project.
 */

const DESCRIPTION_TAG = "[idem-ledger-test]";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FIXTURE_EMAIL = "idem-ledger-owner@mimmobook.local";
const FIXTURE_PASSWORD = "IdemLedgerOwnerPassword!2099";
const FIXTURE_TENANT_NAME = "Idempotent Ledger Tenant";
const FIXTURE_TENANT_SLUG = "idem-ledger-tenant";

const liveModeAvailable = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY missing — opt-in";
  }
  return "ok";
}

function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim().toUpperCase()).digest("hex");
}

function freshPlaintext(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `BETA-${suffix}`;
}

/** Idempotency key honoring the server's 16-128 / printable-ASCII contract. */
function makeIdemKey(label: string): string {
  const rand = randomBytes(8).toString("hex");
  return `idem-${label}-${Date.now()}-${rand}`.slice(0, 120);
}

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

  const { data: existing, error: mErr } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw new Error(`tenant_users lookup failed: ${mErr.message}`);
  if (existing?.tenant_id) {
    return { userId, tenantId: existing.tenant_id as string };
  }

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

async function seedMultiUseCode(
  admin: SupabaseClient,
  plaintext: string,
  createdBy: string,
  maxUses: number,
): Promise<string> {
  const { data, error } = await admin
    .from("access_codes")
    .insert({
      code_hash: hashCode(plaintext),
      code_prefix: plaintext.slice(0, 8),
      // Tag carries the suite marker so a crashed run is recoverable
      // via the shared sweep helper, even if the in-memory tracker dies.
      description: `${DESCRIPTION_TAG} Idempotent ledger invariant test — auto-cleaned`,
      tier: "business",
      duration_days: 7,
      max_uses: maxUses,
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

async function callRedeem(
  token: string,
  code: string,
  idempotencyKey?: string,
): Promise<{
  status: number;
  body: unknown;
  rawText: string;
  replay: string | null;
}> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${token}`,
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-access-code`, {
    method: "POST",
    headers,
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    status: res.status,
    body,
    rawText: text,
    replay: res.headers.get("Idempotent-Replay"),
  };
}

function bodyCode(body: unknown): string {
  return ((body as { code?: string } | null)?.code ?? "").toString();
}

async function readUsedCount(
  admin: SupabaseClient,
  accessCodeId: string,
): Promise<{ used: number; max: number }> {
  const { data, error } = await admin
    .from("access_codes")
    .select("used_count, max_uses")
    .eq("id", accessCodeId)
    .single();
  if (error) throw new Error(`used_count read failed: ${error.message}`);
  return {
    used: (data?.used_count as number) ?? -1,
    max: (data?.max_uses as number) ?? -1,
  };
}

async function ledgerRowCount(
  admin: SupabaseClient,
  accessCodeId: string,
  tenantId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("access_code_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("access_code_id", accessCodeId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`ledger count failed: ${error.message}`);
  return count ?? -1;
}

const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `redeem-access-code — idempotent ledger invariant (live mode: ${skipReason()})`,
  () => {
    let admin: SupabaseClient;
    let userId: string;
    let tenantId: string;
    let token: string;
    let tracker: AccessCodeTracker;

    beforeAll(async () => {
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
      await tracker.sweepStaleRows();
      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      token = await signInAndGetToken();
    }, 60_000);

    afterEach(async () => {
      if (!tracker) return;
      await tracker.cleanupTracked();
      // Also wipe the idempotency cache rows for this user so a key
      // generated in test N never accidentally short-circuits test N+1.
      // The cache is per-(user, key, endpoint); since each test makes
      // fresh keys this is paranoia, but it keeps the suite hermetic.
      await admin
        .from("redemption_idempotency")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", "redeem-access-code");
    }, 30_000);

    afterAll(async () => {
      if (!admin) return;
      if (tracker) {
        await tracker.cleanupTracked();
        await tracker.sweepStaleRows();
      }
      if (tenantId) {
        await admin
          .from("tenants")
          .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
          .eq("id", tenantId);
      }
    }, 30_000);

    it("serial: 8 retries with the same idempotency key bump used_count by EXACTLY 1 (max_uses=3)", async () => {
      const plaintext = freshPlaintext();
      const accessCodeId = await seedMultiUseCode(admin, plaintext, userId, 3);
      tracker.register(accessCodeId);

      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);
      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);

      const key = makeIdemKey("serial");
      const RETRIES = 8;
      const results = [];
      for (let i = 0; i < RETRIES; i++) {
        results.push(await callRedeem(token, plaintext, key));
      }

      // First must be a real 200 success; replays must be byte-identical
      // and carry the Idempotent-Replay marker so we know the cache (not
      // a fresh claim) produced them.
      expect(results[0].status, `first call must succeed: ${results[0].rawText}`).toBe(200);
      for (let i = 1; i < RETRIES; i++) {
        expect(results[i].status, `replay ${i} status drift`).toBe(results[0].status);
        expect(results[i].rawText, `replay ${i} body drift`).toBe(results[0].rawText);
        expect(results[i].replay, `replay ${i} must carry Idempotent-Replay`).toBe("true");
      }

      // THE CORE INVARIANT: ledger has one row, used_count is exactly 1,
      // even though max_uses left room for two more honest redemptions.
      const { used, max } = await readUsedCount(admin, accessCodeId);
      expect(max).toBe(3);
      expect(
        used,
        `idempotent retries must not bump used_count beyond 1; got ${used}`,
      ).toBe(1);
      expect(used).toBeLessThanOrEqual(max);
      expect(await ledgerRowCount(admin, accessCodeId, tenantId)).toBe(1);
    }, 60_000);

    it("parallel: 12 concurrent retries with the same key collapse to one ledger row (max_uses=3)", async () => {
      const plaintext = freshPlaintext();
      const accessCodeId = await seedMultiUseCode(admin, plaintext, userId, 3);
      tracker.register(accessCodeId);

      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);
      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);

      const key = makeIdemKey("burst");
      const PARALLEL = 12;
      const results = await Promise.all(
        Array.from({ length: PARALLEL }, () => callRedeem(token, plaintext, key)),
      );

      // No 5xx allowed under concurrent cache writes.
      const crashes = results.filter((r) => r.status >= 500);
      expect(crashes.length, `unexpected 5xx: ${JSON.stringify(crashes)}`).toBe(0);

      // All responses must agree on status (one canonical outcome).
      const statuses = new Set(results.map((r) => r.status));
      expect(
        statuses.size,
        `concurrent replays diverged on status: ${[...statuses].join(",")}`,
      ).toBe(1);
      // The agreed status must be the success (200), not a generic 4xx
      // — proving the first racer won the claim and the rest replayed it
      // rather than each issuing a fresh failing claim.
      expect([...statuses][0]).toBe(200);

      const bodies = new Set(results.map((r) => r.rawText));
      expect(bodies.size, "concurrent replays diverged on body").toBe(1);

      // Core invariant under contention.
      const { used, max } = await readUsedCount(admin, accessCodeId);
      expect(max).toBe(3);
      expect(
        used,
        `concurrent idempotent retries must not bump used_count beyond 1; got ${used}`,
      ).toBe(1);
      expect(used).toBeLessThanOrEqual(max);
      expect(await ledgerRowCount(admin, accessCodeId, tenantId)).toBe(1);
    }, 90_000);

    it("a DIFFERENT idempotency key after success still cannot double-spend (same-tenant guard)", async () => {
      // Cache hit only fires for the same (user, key). With a fresh key
      // the second call takes the full path and must be blocked by the
      // tenant-already-redeemed gate — never by an empty-cache miss that
      // opens a new write.
      const plaintext = freshPlaintext();
      const accessCodeId = await seedMultiUseCode(admin, plaintext, userId, 3);
      tracker.register(accessCodeId);

      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);
      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);

      const firstKey = makeIdemKey("first");
      const first = await callRedeem(token, plaintext, firstKey);
      expect(first.status, `first redeem must succeed: ${first.rawText}`).toBe(200);

      // New key + new call body — exercises the no-cache-hit path.
      const secondKey = makeIdemKey("second");
      const second = await callRedeem(token, plaintext, secondKey);
      expect(second.status).toBeGreaterThanOrEqual(400);
      expect(second.status).toBeLessThan(500);
      expect(bodyCode(second.body)).toBe("INVALID_OR_UNAVAILABLE_CODE");
      // Critically, NOT a replay — the second key produced a fresh
      // limiter rejection, not a cache hit.
      expect(second.replay).toBeNull();

      // Ledger + counter still pinned at 1, with room to spare.
      const { used, max } = await readUsedCount(admin, accessCodeId);
      expect(used).toBe(1);
      expect(max).toBe(3);
      expect(await ledgerRowCount(admin, accessCodeId, tenantId)).toBe(1);
    }, 60_000);
  },
);

// CI-safe sanity so the file always appears in the report even when the
// live-mode suite is gated off, and so the skip reason is visible.
describe("idempotent ledger invariant — gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[code-redemption-idempotent-ledger] live mode skipped: ${skipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
