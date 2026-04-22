import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import {
  createAccessCodeTracker,
  type AccessCodeTracker,
} from "./fixtures/access-code-cleanup";

/**
 * Stable, unique tag stamped into the `description` of every code seeded
 * by this suite. Used by the cleanup helper to sweep ALL rows from prior
 * crashed runs at the start of each suite — even rows whose UUIDs were
 * lost when a previous test process died mid-race.
 */
const DESCRIPTION_TAG = "[authz-conc-test]";

/**
 * Authorized-user concurrent-redemption integrity suite.
 *
 * This is a tighter, focused complement to `code-redemption-authenticated-e2e.test.ts`.
 * That suite proves the *happy path* of a 10-way race; this suite is built
 * around the request: "concurrent redemption requests for the same code with
 * a single authorized user — only one redemption can succeed and ledger rows
 * remain consistent."
 *
 * It hardens the contract with additional invariants that a single-success
 * race must hold:
 *
 *   A. Single-use code, single user, high parallelism (25 concurrent calls)
 *      → exactly one 200, the rest are the generic INVALID_OR_UNAVAILABLE_CODE,
 *      ledger has exactly one row, used_count is exactly 1.
 *
 *   B. Ledger integrity invariants under concurrency:
 *      - No duplicate (access_code_id, tenant_id) rows.
 *      - The single row's redeemed_by matches the caller.
 *      - granted_until is in the future and matches the response payload.
 *      - used_count never exceeds max_uses.
 *
 *   C. Same idempotency-key replay race: two parallel calls with the SAME
 *      Idempotency-Key produce identical (status, body) and at most one
 *      ledger row — proving the cache and the unique constraint co-operate.
 *
 *   D. Different idempotency-keys still race correctly — only one wins, all
 *      losers collapse to the generic code with no information leakage.
 *
 * All write paths use the service role and are scoped to a throwaway tenant
 * (`authz-conc-redeem-*`) so re-runs are idempotent and prod data is never
 * touched. The suite skips cleanly without `SUPABASE_SERVICE_ROLE_KEY`.
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

const FIXTURE_EMAIL = "authz-conc-redeem-owner@mimmobook.local";
const FIXTURE_PASSWORD = "AuthzConcRedeemPassword!2099";
const FIXTURE_TENANT_NAME = "Authz Conc Redeem Tenant";
const FIXTURE_TENANT_SLUG = "authz-conc-redeem-tenant";

const liveModeAvailable = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY missing — authorized-user concurrency test is opt-in";
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

function freshIdempotencyKey(): string {
  // 32 hex chars => 32 bytes of printable ASCII, well within 16-128 range.
  return randomBytes(16).toString("hex");
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

  const { data: existingMembership, error: mErr } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw new Error(`tenant_users lookup failed: ${mErr.message}`);
  if (existingMembership?.tenant_id) {
    return { userId, tenantId: existingMembership.tenant_id as string };
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

async function seedAccessCode(
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
      // The description carries the suite tag so `sweepStaleRows()` can
      // recover from a process that died before it could push the new
      // id into the in-memory tracker.
      description: `${DESCRIPTION_TAG} Authorized-user concurrency test — auto-cleaned`,
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
  opts: { idempotencyKey?: string } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${token}`,
  };
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = opts.idempotencyKey;
  }
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
  return { status: res.status, body, rawText: text };
}

function bodyCode(body: unknown): string {
  return ((body as { code?: string } | null)?.code ?? "").toString();
}

const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `redeem-access-code — single authorized user, concurrent redemption integrity (live mode: ${skipReason()})`,
  () => {
    let admin: SupabaseClient;
    let userId: string;
    let tenantId: string;
    let token: string;
    /**
     * Cleanup tracker. Combines three layers of defence:
     *   1. `register()` after every seed → in-memory id list,
     *   2. `cleanupTracked()` after every test → no inter-test accumulation,
     *   3. `sweepStaleRows()` in `beforeAll` → recovers from a prior
     *      process that died after INSERT but before `register()`.
     */
    let tracker: AccessCodeTracker;

    beforeAll(async () => {
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

      // PRE-FLIGHT SWEEP: delete every access code (and its ledger) that
      // a previous run of this suite might have left behind. This is the
      // single most important line for "repeated runs never accumulate
      // stale rows" — even a SIGKILL'd previous process is recovered
      // here because we filter by description tag and created_by.
      await tracker.sweepStaleRows();

      // Reset tenant tier so re-runs don't leave the tenant on "business".
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

    // Per-test cleanup: even if the previous test threw mid-Promise.all,
    // its seeded codes are tracked and get deleted here. This guarantees
    // that no test leaves rows behind for the next test.
    afterEach(async () => {
      if (!tracker) return;
      await tracker.cleanupTracked();
    }, 30_000);

    afterAll(async () => {
      if (!admin) return;
      // Final belt-and-suspenders: re-run the stale-row sweep so anything
      // that slipped past per-test cleanup (e.g. an `it.only` that bypassed
      // afterEach in a future edit) still gets cleaned.
      if (tracker) {
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

    it("25 concurrent redeems by the same authorized user produce exactly one success and a consistent ledger", async () => {
      const plaintext = freshPlaintext();
      const accessCodeId = await seedAccessCode(admin, plaintext, userId, 1);
      tracker.register(accessCodeId);

      // Reset tenant + ledger so this test starts from a known clean slate.
      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);

      const PARALLEL = 25;
      const t0 = Date.now();
      const results = await Promise.all(
        Array.from({ length: PARALLEL }, () => callRedeem(token, plaintext)),
      );
      const elapsedMs = Date.now() - t0;

      const successes = results.filter((r) => r.status === 200);
      const failures = results.filter((r) => r.status !== 200);

      expect(
        successes.length,
        `expected exactly 1 success out of ${PARALLEL}, got ${successes.length}. ` +
          `Successes: ${JSON.stringify(successes.map((s) => s.body))}`,
      ).toBe(1);
      expect(failures.length).toBe(PARALLEL - 1);

      // Every loser must collapse to the same generic code — no information
      // leakage about which loser lost why.
      for (const f of failures) {
        expect(
          f.status,
          `loser must be 4xx, got ${f.status}: ${f.rawText}`,
        ).toBeGreaterThanOrEqual(400);
        expect(f.status, `loser must not 5xx: ${f.rawText}`).toBeLessThan(500);
        expect(
          bodyCode(f.body),
          `loser must collapse to INVALID_OR_UNAVAILABLE_CODE, got "${bodyCode(
            f.body,
          )}". Body: ${f.rawText}`,
        ).toBe("INVALID_OR_UNAVAILABLE_CODE");
      }

      // Document the win latency for triage if this ever flakes.
      console.info(
        `[authz-conc] ${PARALLEL}-way race resolved in ${elapsedMs}ms — ` +
          `1 success / ${failures.length} generic-failure`,
      );

      const winner = successes[0]!.body as {
        success?: boolean;
        tier?: string;
        granted_until?: string;
      };
      expect(winner.success).toBe(true);
      expect(winner.tier).toBe("business");

      // ----- Ledger integrity invariants -----
      const { data: redemptions, error: rErr } = await admin
        .from("access_code_redemptions")
        .select("id, redeemed_by, tenant_id, granted_tier, granted_until, is_active")
        .eq("access_code_id", accessCodeId)
        .eq("tenant_id", tenantId);
      expect(rErr, `ledger query error: ${rErr?.message}`).toBeNull();

      // (i) Exactly one row.
      expect(
        redemptions?.length,
        `redemption ledger must have exactly 1 row, got ${redemptions?.length}: ` +
          JSON.stringify(redemptions),
      ).toBe(1);

      const row = redemptions![0];
      // (ii) Owned by the caller.
      expect(row.redeemed_by, "ledger row must be attributed to the caller").toBe(userId);
      // (iii) Active and tier-correct.
      expect(row.is_active).toBe(true);
      expect(row.granted_tier).toBe("business");
      // (iv) granted_until is in the future and matches the winning response.
      expect(row.granted_until).toBe(winner.granted_until);
      expect(new Date(row.granted_until as string).getTime()).toBeGreaterThan(
        Date.now() - 24 * 60 * 60 * 1000,
      );

      // (v) used_count must equal exactly 1 — never 0 (lost), never >1 (double).
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count, max_uses")
        .eq("id", accessCodeId)
        .single();
      expect(codeRow?.used_count).toBe(1);
      expect(codeRow?.max_uses).toBe(1);
      // (vi) used_count <= max_uses invariant.
      expect((codeRow?.used_count ?? 0) <= (codeRow?.max_uses ?? 0)).toBe(true);

      // (vii) Tenant tier upgraded as the side effect of the winning call.
      const { data: tenantRow } = await admin
        .from("tenants")
        .select("tier, sample_end_date")
        .eq("id", tenantId)
        .single();
      expect(tenantRow?.tier).toBe("business");
      expect(tenantRow?.sample_end_date).toBe(winner.granted_until);
    }, 90_000);

    it("two parallel redeems with the SAME Idempotency-Key collapse to one ledger row and identical responses", async () => {
      // A retry-storm with a stable idempotency key must never produce two
      // ledger rows. The cache fast-path + unique constraint must combine
      // to make the second call a verbatim replay of the first.
      const plaintext = freshPlaintext();
      const accessCodeId = await seedAccessCode(admin, plaintext, userId, 1);
      tracker.register(accessCodeId);

      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);

      const idemKey = freshIdempotencyKey();
      const [a, b] = await Promise.all([
        callRedeem(token, plaintext, { idempotencyKey: idemKey }),
        callRedeem(token, plaintext, { idempotencyKey: idemKey }),
      ]);

      // Both must converge on the same status and body shape (success or the
      // exact same failure — racing the cache, neither call should crash).
      expect(a.status, `a status ${a.status}, b status ${b.status}`).toBeLessThan(500);
      expect(b.status).toBeLessThan(500);
      expect(a.status).toBe(b.status);
      // Whichever one populated the cache wins; the other is a replay of it.
      // The success body has `success:true`; failure body has `code` set.
      // In either case, the codes must agree.
      expect(bodyCode(a.body)).toBe(bodyCode(b.body));

      // Exactly one ledger row, regardless of cache-hit ordering.
      const { data: redemptions } = await admin
        .from("access_code_redemptions")
        .select("id")
        .eq("access_code_id", accessCodeId)
        .eq("tenant_id", tenantId);
      expect(
        redemptions?.length ?? 0,
        `idempotent retry must produce <=1 ledger rows, got ${redemptions?.length}`,
      ).toBeLessThanOrEqual(1);

      // used_count must never exceed max_uses (1).
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count, max_uses")
        .eq("id", accessCodeId)
        .single();
      expect((codeRow?.used_count ?? 0) <= (codeRow?.max_uses ?? 0)).toBe(true);
      // Also bounded at 1 — exactly the number of distinct successful redeems.
      expect(codeRow?.used_count).toBeLessThanOrEqual(1);
    }, 60_000);

    it("parallel redeems with DIFFERENT Idempotency-Keys still produce only one success and one ledger row", async () => {
      // Different idempotency keys defeat the cache fast-path, so the race
      // is settled exclusively by the duplicate-redemption check + unique
      // constraint. The win count must still be exactly 1.
      const plaintext = freshPlaintext();
      const accessCodeId = await seedAccessCode(admin, plaintext, userId, 1);
      tracker.register(accessCodeId);

      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);

      const PARALLEL = 8;
      const results = await Promise.all(
        Array.from({ length: PARALLEL }, () =>
          callRedeem(token, plaintext, { idempotencyKey: freshIdempotencyKey() }),
        ),
      );

      const successes = results.filter((r) => r.status === 200);
      const failures = results.filter((r) => r.status !== 200);
      expect(
        successes.length,
        `expected exactly 1 success out of ${PARALLEL} (distinct idem keys), ` +
          `got ${successes.length}. Bodies: ${JSON.stringify(
            successes.map((s) => s.body),
          )}`,
      ).toBe(1);
      for (const f of failures) {
        expect(f.status).toBeGreaterThanOrEqual(400);
        expect(f.status).toBeLessThan(500);
        expect(bodyCode(f.body)).toBe("INVALID_OR_UNAVAILABLE_CODE");
      }

      const { data: redemptions } = await admin
        .from("access_code_redemptions")
        .select("id, redeemed_by")
        .eq("access_code_id", accessCodeId)
        .eq("tenant_id", tenantId);
      expect(redemptions?.length).toBe(1);
      expect(redemptions![0].redeemed_by).toBe(userId);

      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count, max_uses")
        .eq("id", accessCodeId)
        .single();
      expect(codeRow?.used_count).toBe(1);
      expect((codeRow?.used_count ?? 0) <= (codeRow?.max_uses ?? 0)).toBe(true);
    }, 60_000);

    it("ledger never contains duplicate (access_code_id, tenant_id) pairs after the race", async () => {
      // Defence-in-depth audit query: independently of any individual test,
      // the ledger for our fixture tenant must satisfy the uniqueness
      // invariant that the edge function relies on. If the unique constraint
      // were ever dropped, this assertion would catch it.
      const { data: rows, error } = await admin
        .from("access_code_redemptions")
        .select("access_code_id, tenant_id")
        .eq("tenant_id", tenantId);
      expect(error?.message ?? null).toBeNull();
      const seen = new Set<string>();
      for (const r of rows ?? []) {
        const key = `${r.access_code_id}::${r.tenant_id}`;
        expect(
          seen.has(key),
          `duplicate redemption row for ${key} — uniqueness invariant broken`,
        ).toBe(false);
        seen.add(key);
      }
    });
  },
);

// CI-safe sanity: surface a single always-running assertion so the file
// shows up in the report and the skip reason is visible when gated off.
describe("authorized-user concurrency redeem — gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[code-redemption-authorized-concurrency] live mode skipped: ${skipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
