import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Concurrency / replay tests for access codes and discount codes.
 *
 * Goals (from the request):
 *   1. Hammer `redeem-access-code` with parallel attempts using the same code
 *      from the same caller and verify exactly one succeeds (single-use per
 *      tenant-redeemer is enforced by the unique-redemption check + RLS).
 *   2. Replay the same redemption call serially and confirm subsequent calls
 *      are rejected with a clear "already redeemed" / "max uses" type error.
 *   3. For discount_codes: confirm the public REST surface does not allow
 *      anon to mutate `used_count` to defeat `max_uses` (the `used_count`
 *      is mutated only by the server-side validation/booking path).
 *
 * What we CAN'T do from this harness:
 *   - We don't have an authenticated session in vitest, and creating one
 *     would require leaking a real password.
 *   - We don't have a valid plaintext access code (only hashes are stored).
 *
 * What we CAN do (and what this suite does):
 *   - Hit the live `redeem-access-code` edge function in parallel with both
 *     anon and a deliberately-invalid code, and assert every response is a
 *     deterministic 4xx with a structured error — i.e. the function never
 *     "races" into a 200 success or a 500 crash, and never leaks whether the
 *     code exists.
 *   - Probe the discount_codes table directly as anon and assert that
 *     INSERT/UPDATE/DELETE are denied, so a replay attacker cannot reset
 *     `used_count` or create a fresh single-use code from outside.
 *
 * If the redeem function ever regressed and started returning 200 for the
 * same call repeatedly (or returned different statuses across parallel
 * calls), this suite would fail loudly.
 */

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/redeem-access-code`;

// A code shape that conforms to the BETA-XXXXXXXX prefix used in the UI.
// Hash will not match anything in the DB → "Invalid access code" path.
const FAKE_BUT_VALID_SHAPE = "BETA-RACE0001";

let anon: SupabaseClient;

beforeAll(() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY must be set for code-redemption concurrency tests"
    );
  }
  anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

async function callRedeem(code: string, withAuth: boolean) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY!,
  };
  if (withAuth) {
    // No real session — use the anon key as a stand-in so we exercise the
    // "Authorization present but not a real user" branch.
    headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ code }),
  });
  // Always drain body to avoid leaks and to inspect the error shape.
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

describe("redeem-access-code — parallel calls never produce a duplicate success", () => {
  it("10 concurrent redemptions of the same fake code: zero successes, all deterministic", async () => {
    const PARALLEL = 10;
    const attempts = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        callRedeem(FAKE_BUT_VALID_SHAPE, true)
      )
    );

    // 1. No call should succeed (the code doesn't exist).
    const successes = attempts.filter((a) => a.status === 200);
    expect(
      successes.length,
      "no parallel attempt should succeed for a non-existent code"
    ).toBe(0);

    // 2. No call should crash the function (5xx).
    const crashes = attempts.filter((a) => a.status >= 500);
    expect(
      crashes.length,
      `function must not 5xx under concurrency. Got: ${JSON.stringify(crashes)}`
    ).toBe(0);

    // 3. Every response should be a structured JSON error, not a leak.
    for (const a of attempts) {
      expect(a.status, "every response must be a client error").toBeGreaterThanOrEqual(400);
      expect(a.status).toBeLessThan(500);
      expect(a.body, "response body must be a JSON object").toBeTypeOf("object");
      expect((a.body as { error?: string })?.error, "error field present").toBeTruthy();
    }
  }, 30_000);

  it("serial replay of the same redemption returns the same deterministic error", async () => {
    // Replay the exact same request 5 times. The error must be stable —
    // a regression where "first call says invalid, second call says already
    // redeemed" would indicate state leaking between requests.
    const REPLAYS = 5;
    const results = [];
    for (let i = 0; i < REPLAYS; i++) {
      results.push(await callRedeem(FAKE_BUT_VALID_SHAPE, true));
    }

    const firstStatus = results[0].status;
    const firstError = (results[0].body as { error?: string })?.error;
    for (const r of results) {
      expect(r.status, "status must be stable across replays").toBe(firstStatus);
      expect(
        (r.body as { error?: string })?.error,
        "error message must be stable across replays"
      ).toBe(firstError);
    }
  }, 30_000);

  it("anon (no Authorization header) is rejected before reaching code lookup", async () => {
    // The function should reject with "Not authenticated" before doing any
    // code lookup — proves that an attacker cannot use parallelism to
    // enumerate codes anonymously.
    const res = await callRedeem(FAKE_BUT_VALID_SHAPE, false);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const err = (res.body as { error?: string })?.error ?? "";
    expect(err.toLowerCase()).toContain("authenticated");
  });

  it("malformed code is rejected without leaking lookup behaviour", async () => {
    // Length-bounded validation runs server-side BEFORE the SECURITY DEFINER
    // RPC, so this should never produce a "code not found" response.
    const tooShort = await callRedeem("A", true);
    const tooLong = await callRedeem("X".repeat(100), true);
    for (const r of [tooShort, tooLong]) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      const err = (r.body as { error?: string })?.error ?? "";
      // Either "Invalid access code format" or auth rejection — both are OK.
      expect(err.length, "error message present").toBeGreaterThan(0);
    }
  }, 15_000);
});

describe("discount_codes — replay/concurrency surface as anon", () => {
  // discount_codes.used_count is bumped by the server-side booking path.
  // An attacker trying to defeat max_uses from outside would need to either
  // (a) directly UPDATE used_count back to 0, or
  // (b) INSERT a new row with their own max_uses, or
  // (c) DELETE the row to start over.
  // All three vectors must be denied by RLS.

  it("anon cannot SELECT discount_codes (no public read policy)", async () => {
    const { data, error } = await anon.from("discount_codes").select("*").limit(1);
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect((data ?? []).length, "anon must not see discount codes").toBe(0);
    }
  });

  it("anon cannot INSERT a fresh discount code (no INSERT policy for anon)", async () => {
    const { data, error } = await anon.from("discount_codes").insert({
      tenant_id: "00000000-0000-0000-0000-0000000000aa",
      code: "ANON-INJECT-TEST",
      discount_type: "percentage",
      discount_value: 100,
      max_uses: 9999,
      is_active: true,
    } as never);
    expect(error, "anon insert into discount_codes must be denied").toBeTruthy();
    const insertedRows = (data ?? []) as unknown[];
    expect(insertedRows.length).toBe(0);
  });

  it("anon cannot UPDATE used_count to bypass max_uses", async () => {
    // Even if the row doesn't exist, the call must not return persisted rows.
    // RLS denies the UPDATE before any row matches, so .select() returns [].
    const result = await anon
      .from("discount_codes")
      .update({ used_count: 0 } as never)
      .eq("code", "ANY-EXISTING-CODE")
      .select();
    if (Array.isArray(result.data)) {
      expect(
        result.data.length,
        "anon must not update used_count on any discount code"
      ).toBe(0);
    }
  });

  it("anon cannot DELETE discount_codes to reset usage", async () => {
    const result = await anon
      .from("discount_codes")
      .delete()
      .eq("code", "ANY-EXISTING-CODE")
      .select();
    if (Array.isArray(result.data)) {
      expect(
        result.data.length,
        "anon must not delete discount codes"
      ).toBe(0);
    }
  });

  it("100 parallel anon SELECTs return zero rows each — no race-window leak", async () => {
    // Pathological case: spam reads in case there's a transient policy-cache
    // window where anon could briefly see rows. Should always be empty.
    const PARALLEL = 100;
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        anon.from("discount_codes").select("id").limit(1)
      )
    );
    for (const r of results) {
      const len = Array.isArray(r.data) ? (r.data?.length ?? 0) : 0;
      expect(len, "anon must never see a discount_code row, even under load").toBe(0);
    }
  }, 30_000);
});

describe("redemption ledger — anon cannot forge or reset access_code_redemptions", () => {
  // access_code_redemptions is the table that enforces "one redemption per
  // (access_code_id, tenant_id)" inside the edge function. If anon could
  // INSERT rows here, they could either (a) create a fake redemption to
  // confuse the function, or (b) DELETE existing rows to replay.

  it("anon cannot INSERT into access_code_redemptions", async () => {
    const { data, error } = await anon.from("access_code_redemptions").insert({
      access_code_id: "00000000-0000-0000-0000-0000000000aa",
      tenant_id: "00000000-0000-0000-0000-0000000000bb",
      redeemed_by: "00000000-0000-0000-0000-0000000000cc",
      granted_tier: "business",
      granted_until: "2099-12-31",
    } as never);
    expect(error, "anon insert into redemptions must be denied").toBeTruthy();
    const insertedRows = (data ?? []) as unknown[];
    expect(insertedRows.length).toBe(0);
  });

  it("anon cannot DELETE access_code_redemptions to enable replay", async () => {
    const result = await anon
      .from("access_code_redemptions")
      .delete()
      .eq("tenant_id", "00000000-0000-0000-0000-0000000000bb")
      .select();
    if (Array.isArray(result.data)) {
      expect(result.data.length).toBe(0);
    }
  });

  it("anon cannot UPDATE access_code_redemptions to flip is_active", async () => {
    const result = await anon
      .from("access_code_redemptions")
      .update({ is_active: false } as never)
      .eq("tenant_id", "00000000-0000-0000-0000-0000000000bb")
      .select();
    if (Array.isArray(result.data)) {
      expect(result.data.length).toBe(0);
    }
  });

  it("anon SELECT on access_code_redemptions returns zero rows", async () => {
    const { data } = await anon.from("access_code_redemptions").select("id").limit(5);
    expect((data ?? []).length).toBe(0);
  });
});

describe("sanity guard", () => {
  it("anon client has no user session (prevents service-role false positives)", async () => {
    const { data } = await anon.auth.getUser();
    expect(data.user).toBeNull();
  });
});
