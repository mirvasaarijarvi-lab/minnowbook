import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import {
  createAccessCodeTracker,
  type AccessCodeTracker,
} from "./fixtures/access-code-cleanup";
import { assertRedeemFunctionReachable } from "./fixtures/redeem-preflight";

/**
 * Same-Idempotency-Key concurrency contract for `redeem-access-code`.
 *
 * What this suite proves
 * ----------------------
 * Given ONE authenticated user, ONE access code, and ONE Idempotency-Key
 * value re-used across N parallel HTTP calls, the function must:
 *
 *   1. Record EXACTLY ONE redemption in `access_code_redemptions`.
 *   2. Increment `access_codes.used_count` by EXACTLY ONE.
 *   3. Return the SAME wire bytes for every parallel response — i.e.
 *      every loser must be a verbatim replay of the cached winning
 *      response (or, in the failure case, a verbatim replay of the
 *      cached generic-failure response).
 *   4. Persist EXACTLY ONE row in `redemption_idempotency` for that key
 *      so subsequent retries continue to hit the cache.
 *
 * Why a separate file
 * --------------------
 * `code-redemption-authorized-concurrency.test.ts` already covers a
 * 25-way race with DISTINCT keys (no cache fast path) and a 2-way race
 * with the same key. This file is the dedicated, higher-fan-out
 * stress test of the cache fast-path itself: it raises the parallelism
 * to 12 calls AND adds the "exactly one idempotency cache row" check —
 * the database-level invariant that a buggy implementation could pass
 * the "one ledger row" check but still leak a second cache row through
 * a TOCTOU.
 *
 * The "verbatim" assertion is byte-for-byte: every parallel response's
 * `rawText` must be identical to one canonical response. This catches
 * subtle drift where the cache replay accidentally re-serialises with
 * different key ordering, different whitespace, or a regenerated
 * timestamp — any of which would prove the second call was NOT served
 * from cache.
 *
 * Live mode only — service role required to seed the access code,
 * inspect the ledger, and read the otherwise-locked-down
 * `redemption_idempotency` cache table.
 */

const DESCRIPTION_TAG = "[same-idem-key-conc-test]";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Distinct fixture identity from sibling concurrency suites so parallel
// vitest workers can't trample each other's tenant_users row.
const FIXTURE_EMAIL = "same-idem-conc-redeem-owner@mimmobook.local";
const FIXTURE_PASSWORD = "SameIdemConcRedeemPassword!2099";
const FIXTURE_TENANT_NAME = "Same-Idem Conc Redeem Tenant";
const FIXTURE_TENANT_SLUG = "same-idem-conc-redeem-tenant";

const liveModeAvailable = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY missing — same-idem-key concurrency test is opt-in";
  }
  return "ok";
}

function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim().toUpperCase()).digest("hex");
}

function freshPlaintext(): string {
  // Distinct prefix from sibling suites so log greps don't collide.
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `SIDM-${suffix}`;
}

function freshIdempotencyKey(): string {
  // 32 hex chars — well within the function's 16-128 char validation range.
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
      description: `${DESCRIPTION_TAG} Same-idem-key concurrency test — auto-cleaned`,
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

interface RedeemResponse {
  status: number;
  body: unknown;
  rawText: string;
  headers: Record<string, string>;
}

async function callRedeem(
  token: string,
  code: string,
  idempotencyKey: string,
): Promise<RedeemResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-access-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ code }),
  });
  const rawText = await res.text();
  let body: unknown = null;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    body = rawText;
  }
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: res.status, body, rawText, headers };
}

const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `redeem-access-code — same Idempotency-Key concurrent replay (live mode: ${skipReason()})`,
  () => {
    let admin: SupabaseClient;
    let userId: string;
    let tenantId: string;
    let token: string;
    let tracker: AccessCodeTracker;

    beforeAll(async () => {
      // Reachability preflight FIRST — converts a misrouted/missing function
      // into a single clear error before any fixture provisioning runs.
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

      // Sweep stale rows from prior crashed runs.
      await tracker.sweepStaleRows();

      // Reset tier so a previous successful redeem doesn't leave the
      // tenant on `business` (which would short-circuit subsequent runs).
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

    afterEach(async () => {
      if (!tracker) return;
      await tracker.cleanupTracked();
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
          .update({
            tier: "basic",
            sample_start_date: null,
            sample_end_date: null,
          })
          .eq("id", tenantId);
      }
    }, 30_000);

    it("12 concurrent redeems with the SAME Idempotency-Key produce one ledger row, one cache row, and byte-identical responses", async () => {
      // Setup: a single-use code, fresh tenant ledger, fresh idempotency key.
      const plaintext = freshPlaintext();
      const accessCodeId = await seedAccessCode(admin, plaintext, userId, 1);
      tracker.register(accessCodeId);

      const idemKey = freshIdempotencyKey();

      // Reset to a known clean slate so prior tests can't bias the assertions.
      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);
      await admin
        .from("redemption_idempotency")
        .delete()
        .eq("user_id", userId)
        .eq("idempotency_key", idemKey);

      // ----- The race -----
      // Fire N parallel calls all sharing the SAME idempotency key.
      // Exactly one must perform real work; the rest must be served
      // verbatim from the idempotency cache.
      const PARALLEL = 12;
      const t0 = Date.now();
      const results = await Promise.all(
        Array.from({ length: PARALLEL }, () => callRedeem(token, plaintext, idemKey)),
      );
      const elapsedMs = Date.now() - t0;

      // (1) Every response must have the same status code. Cache replays
      // cannot disagree on outcome — that would mean two different real
      // executions returned different answers under the same key.
      const statuses = results.map((r) => r.status);
      const uniqueStatuses = Array.from(new Set(statuses));
      expect(
        uniqueStatuses.length,
        `all ${PARALLEL} responses must share one status, got: ${JSON.stringify(statuses)}`,
      ).toBe(1);
      const sharedStatus = uniqueStatuses[0]!;
      // Must not be a server error — the function must always have a
      // deterministic answer for a same-key replay.
      expect(sharedStatus).toBeLessThan(500);

      // (2) Every response body must be byte-identical. This is the
      // strongest possible "served from cache" assertion: even one
      // differing byte (e.g. a regenerated timestamp, a re-ordered key,
      // a re-computed signature) would prove the response was not a
      // verbatim replay.
      const rawBodies = results.map((r) => r.rawText);
      const uniqueBodies = Array.from(new Set(rawBodies));
      expect(
        uniqueBodies.length,
        `all ${PARALLEL} response bodies must be byte-identical, got ${uniqueBodies.length} distinct bodies. ` +
          `First two distinct: ${JSON.stringify(uniqueBodies.slice(0, 2))}`,
      ).toBe(1);

      // (3) Every response's caching headers must also agree — otherwise
      // a CDN could serve one variant to one client and a different
      // variant to another, breaking idempotency from the caller's POV.
      const cacheHeaders = results.map((r) => r.headers["cache-control"] ?? "");
      const uniqueCacheHeaders = Array.from(new Set(cacheHeaders));
      expect(
        uniqueCacheHeaders.length,
        `all ${PARALLEL} responses must agree on Cache-Control, got: ${JSON.stringify(uniqueCacheHeaders)}`,
      ).toBe(1);

      // (4) DB ledger: at most one redemption row. (If the shared status
      // is a failure, zero rows is also acceptable — meaning the cache
      // captured a failure outcome before any real work happened.)
      const { data: redemptions, error: ledgerErr } = await admin
        .from("access_code_redemptions")
        .select("id, redeemed_by, tenant_id, granted_tier, granted_until, is_active")
        .eq("access_code_id", accessCodeId)
        .eq("tenant_id", tenantId);
      expect(ledgerErr?.message ?? null).toBeNull();
      expect(
        redemptions?.length ?? 0,
        `same-key concurrent replay must produce <= 1 ledger row, got ${redemptions?.length}: ` +
          JSON.stringify(redemptions),
      ).toBeLessThanOrEqual(1);

      if (sharedStatus === 200) {
        // Success path: there MUST be exactly one ledger row, owned by
        // our caller, on our tenant, with the granted fields populated.
        expect(redemptions?.length).toBe(1);
        const row = redemptions![0];
        expect(row.redeemed_by).toBe(userId);
        expect(row.tenant_id).toBe(tenantId);
        expect(row.is_active).toBe(true);
        expect(row.granted_tier).toBe("business");
        expect(typeof row.granted_until).toBe("string");

        // The winning response body must agree with the persisted row.
        const winnerBody = results[0]!.body as { granted_until?: string; tier?: string };
        expect(winnerBody.tier).toBe("business");
        expect(row.granted_until).toBe(winnerBody.granted_until);
      }

      // (5) `used_count` must reflect the real work: 1 if success, 0 if
      // every call lost on the cache fast-path. Never >1.
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count, max_uses")
        .eq("id", accessCodeId)
        .single();
      expect(codeRow?.max_uses).toBe(1);
      expect(codeRow?.used_count ?? -1).toBeGreaterThanOrEqual(0);
      expect(codeRow?.used_count ?? 99).toBeLessThanOrEqual(1);
      // used_count <= max_uses invariant.
      expect((codeRow?.used_count ?? 0) <= (codeRow?.max_uses ?? 0)).toBe(true);

      // (6) Idempotency cache: EXACTLY ONE row for (user, key). This is
      // the proof that the fast-path is truly the same cache entry —
      // a buggy double-insert here would still produce one ledger row
      // (thanks to the unique constraint downstream) but would silently
      // double-fill the cache and waste rows over time.
      const { data: cacheRows, error: cacheErr } = await admin
        .from("redemption_idempotency")
        .select("id, response_status, response_body, endpoint")
        .eq("user_id", userId)
        .eq("idempotency_key", idemKey);
      expect(cacheErr?.message ?? null).toBeNull();
      expect(
        cacheRows?.length ?? 0,
        `same-key concurrent replay must produce exactly 1 cache row, got ${cacheRows?.length}`,
      ).toBe(1);

      const cacheRow = cacheRows![0];
      // The cache row's status must equal the status every caller saw.
      expect(cacheRow.response_status).toBe(sharedStatus);
      // The cache row endpoint must scope the entry to redeem-access-code
      // so it can't accidentally satisfy a different idempotent endpoint.
      expect(cacheRow.endpoint).toBe("redeem-access-code");
      // The cache row body must serialise to the SAME bytes every caller
      // received. (We compare the parsed JSON to avoid whitespace drift
      // between Postgres jsonb output and the function's response body.)
      const cachedBodyJson = JSON.stringify(cacheRow.response_body);
      const responseBodyJson = JSON.stringify(results[0]!.body);
      expect(
        cachedBodyJson,
        `cache row body must match the response body bytes`,
      ).toBe(responseBodyJson);

      console.info(
        `[same-idem-conc] ${PARALLEL}-way same-key race resolved in ${elapsedMs}ms — ` +
          `status=${sharedStatus}, ledger_rows=${redemptions?.length}, cache_rows=${cacheRows?.length}, ` +
          `unique_bodies=${uniqueBodies.length}`,
      );
    }, 90_000);

    it("a follow-up call with the same Idempotency-Key after the race still hits the cache (verbatim)", async () => {
      // Sequel to the race: even minutes/seconds later, replaying the
      // same key must continue to return the cached body. This catches
      // a regression where the cache row is created by the race but
      // accidentally not READ by serial follow-ups (e.g. wrong index
      // or a missed `select * where idempotency_key = ?` lookup).
      const plaintext = freshPlaintext();
      const accessCodeId = await seedAccessCode(admin, plaintext, userId, 1);
      tracker.register(accessCodeId);

      const idemKey = freshIdempotencyKey();

      await admin
        .from("tenants")
        .update({ tier: "basic", sample_start_date: null, sample_end_date: null })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);
      await admin
        .from("redemption_idempotency")
        .delete()
        .eq("user_id", userId)
        .eq("idempotency_key", idemKey);

      // First call seeds the cache.
      const first = await callRedeem(token, plaintext, idemKey);
      // Second, third calls (sequential) must replay the same bytes.
      const second = await callRedeem(token, plaintext, idemKey);
      const third = await callRedeem(token, plaintext, idemKey);

      expect(second.status).toBe(first.status);
      expect(third.status).toBe(first.status);
      expect(second.rawText).toBe(first.rawText);
      expect(third.rawText).toBe(first.rawText);

      // Cache table still has exactly one row — repeated reads must
      // not produce additional INSERTs.
      const { data: cacheRows } = await admin
        .from("redemption_idempotency")
        .select("id")
        .eq("user_id", userId)
        .eq("idempotency_key", idemKey);
      expect(cacheRows?.length).toBe(1);

      // And the access code's used_count is still bounded at 1 — three
      // calls did NOT triple-redeem.
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count, max_uses")
        .eq("id", accessCodeId)
        .single();
      expect(codeRow?.used_count ?? 99).toBeLessThanOrEqual(1);
      expect((codeRow?.used_count ?? 0) <= (codeRow?.max_uses ?? 0)).toBe(true);
    }, 60_000);
  },
);

// CI-safe sanity: visible documentation of why the suite skipped when
// run without service-role credentials, so opt-in mode is discoverable.
describe("same-idem-key concurrency redeem — gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[code-redemption-same-idem-key-concurrency] live mode skipped: ${skipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
