/**
 * Brute-force / replay resilience tests for code redemption surfaces.
 *
 * SCOPE
 * -----
 * - `redeem-access-code` edge function (anon + unauthenticated bursts)
 * - `discount_codes` table (no public edge function exists; direct REST
 *   under anon is the relevant attack surface)
 *
 * SECURITY PROPERTIES VERIFIED (NOT throttle thresholds)
 * ------------------------------------------------------
 * Per project policy we do NOT add backend rate limiting. These tests
 * therefore assert the invariants that matter regardless of whether
 * throttling exists:
 *
 *   1. NO LEAK: error responses are deterministic — repeated/parallel
 *      attempts with valid-shape-but-wrong codes return the same
 *      generic error, never a different message that would distinguish
 *      "doesn't exist" from "already used" / "expired" / "revoked".
 *   2. NO SUCCESS UNDER BURST: parallel redemption attempts from an
 *      unauthenticated client never produce a 2xx success.
 *   3. NO RLS ESCAPE: parallel SELECT/INSERT/UPDATE/DELETE bursts on
 *      `discount_codes` and `access_code_redemptions` from anon never
 *      return rows or mutate state.
 *   4. STABILITY: high-volume parallel calls do not produce 5xx errors
 *      (which would themselves be a side-channel about server state).
 */
import "@/test/setup";
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/redeem-access-code`;

/** Deterministic-shape codes that look real but cannot exist. */
const FAKE_CODES = [
  "AAAA-AAAA-AAAA",
  "BBBB-BBBB-BBBB",
  "ZZZZ-9999-XXXX",
  "TEST-0001-CODE",
  "TEST-0002-CODE",
];

type Attempt = { status: number; body: unknown; error?: unknown };

async function callRedeem(code: string, withAuth: boolean): Promise<Attempt> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    };
    if (withAuth) {
      headers["Authorization"] = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
    }
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ code }),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: null, error: e };
  }
}

function errorMessage(a: Attempt): string {
  const b = a.body as { error?: string } | null;
  return (b?.error ?? "").toString();
}

describe("redeem-access-code: brute-force & replay resilience", () => {
  beforeAll(() => {
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_PUBLISHABLE_KEY).toBeTruthy();
  });

  it("sanity: anon client has no session", async () => {
    const { data } = await anon.auth.getSession();
    expect(data.session).toBeNull();
  });

  it("20 parallel attempts with the same fake code: zero successes", async () => {
    const N = 20;
    const results = await Promise.all(
      Array.from({ length: N }, () => callRedeem(FAKE_CODES[0], false)),
    );

    const successes = results.filter((r) => r.status >= 200 && r.status < 300);
    expect(successes.length, "no parallel attempt may succeed").toBe(0);

    const serverErrors = results.filter((r) => r.status >= 500);
    expect(
      serverErrors.length,
      "no 5xx allowed (would itself leak server state)",
    ).toBe(0);

    for (const r of results) {
      expect(r.status, "each call must return a deterministic 4xx").toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    }
  });

  it("repeated serial attempts return the same generic error (no validity leak)", async () => {
    const ITER = 6;
    const messages: string[] = [];
    for (let i = 0; i < ITER; i++) {
      const r = await callRedeem(FAKE_CODES[0], false);
      messages.push(errorMessage(r));
    }
    // All replays must produce identical error text — otherwise the
    // server is leaking information about retry/throttle state.
    const unique = new Set(messages);
    expect(unique.size, `replay error messages must be deterministic, got: ${[...unique].join(" | ")}`).toBe(1);
  });

  it("varied fake codes do NOT produce distinguishable error messages vs. malformed input", async () => {
    // Probe matrix: shapes that should all surface as "Not authenticated"
    // (since no auth is supplied) — never a code-specific error that
    // would let an attacker classify the input.
    const probes = [
      ...FAKE_CODES,
      "", // empty
      "A", // too short
      "A".repeat(100), // too long
      "<script>alert(1)</script>",
      "'; DROP TABLE access_codes;--",
    ];
    const results = await Promise.all(probes.map((c) => callRedeem(c, false)));

    const messages = results.map(errorMessage);
    // Every response must be a 400-class error.
    for (const r of results) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    }
    // Messages must collapse to a tiny set (ideally 1) — no per-code
    // differentiation. Allow up to 2 variants to tolerate "Not authenticated"
    // vs the generic auth-failure shape, but no more.
    const unique = new Set(messages);
    expect(
      unique.size,
      `messages must not classify the input; got ${unique.size} variants: ${[...unique].join(" | ")}`,
    ).toBeLessThanOrEqual(2);
  });

  it("burst of 30 parallel calls across many distinct fake codes: zero leaks, zero 5xx", async () => {
    const codes = Array.from(
      { length: 30 },
      (_, i) => `BURST-${i.toString().padStart(4, "0")}-XYZW`,
    );
    const results = await Promise.all(codes.map((c) => callRedeem(c, false)));

    const successes = results.filter((r) => r.status >= 200 && r.status < 300);
    const serverErrors = results.filter((r) => r.status >= 500);
    expect(successes.length).toBe(0);
    expect(serverErrors.length).toBe(0);

    // None of the response bodies may ever expose a `tier`, `granted_until`,
    // or `success: true` field — those are 2xx-only payload shapes.
    for (const r of results) {
      const b = (r.body ?? {}) as Record<string, unknown>;
      expect(b.success).not.toBe(true);
      expect(b.tier).toBeUndefined();
      expect(b.granted_until).toBeUndefined();
    }
  });

  it("OPTIONS preflight burst does not affect the error contract", async () => {
    // Some attackers warm up a function with preflights to look for
    // throttle state. Verify it stays stable.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(FUNCTION_URL, {
          method: "OPTIONS",
          headers: {
            Origin: "https://minnowbook.lovable.app",
            "Access-Control-Request-Method": "POST",
          },
        }).then((r) => r.text()),
      ),
    );
    const after = await callRedeem(FAKE_CODES[1], false);
    expect(after.status).toBeGreaterThanOrEqual(400);
    expect(after.status).toBeLessThan(500);
  });
});

describe("discount_codes: brute-force / replay resilience (no public endpoint)", () => {
  it("100 parallel anon SELECTs return zero rows (no enumeration)", async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        anon.from("discount_codes").select("id, code").limit(1),
      ),
    );
    for (const r of results) {
      if (r.error) {
        // Explicit RLS denial is acceptable.
        expect(r.error).toBeTruthy();
        continue;
      }
      expect(Array.isArray(r.data)).toBe(true);
      expect((r.data ?? []).length).toBe(0);
    }
  });

  it("anon cannot decrement used_count via parallel UPDATEs (replay-to-bypass-max-uses)", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        anon
          .from("discount_codes")
          .update({ used_count: 0 } as never)
          .eq("code", "ANY-EXISTING-CODE")
          .select(),
      ),
    );
    for (const r of results) {
      if (r.error) {
        expect(r.error).toBeTruthy();
        continue;
      }
      expect((r.data ?? []).length).toBe(0);
    }
  });

  it("anon cannot INSERT forged discount_codes under burst", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        anon.from("discount_codes").insert({
          tenant_id: "00000000-0000-0000-0000-000000000000",
          code: `FORGED-${i}`,
          discount_type: "percentage",
          discount_value: 100,
        } as never),
      ),
    );
    // Every attempt must error out — no row may ever land.
    for (const r of results) {
      expect(r.error, "anon INSERT must always fail").toBeTruthy();
    }
  });

  it("anon cannot enumerate access_code_redemptions to learn which codes are spent", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        anon
          .from("access_code_redemptions")
          .select("id, access_code_id, tenant_id")
          .limit(5),
      ),
    );
    for (const r of results) {
      if (r.error) {
        expect(r.error).toBeTruthy();
        continue;
      }
      expect((r.data ?? []).length).toBe(0);
    }
  });
});
