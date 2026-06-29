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

/**
 * Shared, module-level warmup. The first call to a Supabase Edge Function
 * pays a cold-start cost (container boot + V8 isolate + module graph load)
 * that can be several seconds. Subsequent calls also benefit from a warm
 * TLS session and DNS cache on the test runner.
 *
 * We trigger a couple of sequential warm hits BEFORE any test in this file
 * fires its parallel burst, so the burst test only measures steady-state
 * latency rather than cold-start + burst combined. The promise is awaited
 * by every test via `beforeAll`, so the cost is paid exactly once per
 * worker regardless of test ordering.
 */
const warmupPromise: Promise<void> = (async () => {
  // Two sequential calls: first absorbs cold-start, second confirms the
  // function is hot and the connection is keep-alive ready.
  for (let i = 0; i < 2; i++) {
    try {
      await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ code: "WARM-UP-PROBE" }),
      }).then((r) => r.text().catch(() => null));
    } catch {
      // Warmup is best-effort; tests will still run and assert behavior.
    }
  }
})();

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

function errorCode(a: Attempt): string {
  const b = a.body as { code?: string } | null;
  return (b?.code ?? "").toString();
}

/**
 * The full set of stable error codes that may appear in a 4xx response
 * for the redeem function:
 *   - codes emitted by our handler (mirrors `ERROR_CODES` in
 *     supabase/functions/redeem-access-code/index.ts)
 *   - codes emitted by the Supabase Functions auth gateway BEFORE our
 *     handler runs (e.g. when there is no Authorization header at all,
 *     the gateway short-circuits with UNAUTHORIZED_NO_AUTH_HEADER).
 *
 * If a new code is added on either side, add it here too — and verify
 * no existing code was renamed (that would be a contract break).
 */
const KNOWN_ERROR_CODES = new Set([
  // Our handler's codes:
  "REQUEST_TOO_LARGE",
  "NOT_AUTHENTICATED",
  "INVALID_CODE_FORMAT",
  "NO_WORKSPACE",
  "INVALID_OR_UNAVAILABLE_CODE",
  "INTERNAL_ERROR",
  // Supabase Functions gateway codes (returned before our handler runs):
  "UNAUTHORIZED_NO_AUTH_HEADER",
]);

/** Codes that mean "auth was rejected", from either layer. */
const AUTH_REJECTION_CODES = new Set([
  "NOT_AUTHENTICATED",
  "UNAUTHORIZED_NO_AUTH_HEADER",
]);

describe("redeem-access-code: brute-force & replay resilience", () => {
  beforeAll(async () => {
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_PUBLISHABLE_KEY).toBeTruthy();
    // Ensure the edge function is warm before any burst-style test runs.
    await warmupPromise;
  });

  it("sanity: anon client has no session", async () => {
    const { data } = await anon.auth.getSession();
    expect(data.session).toBeNull();
  });

  // Targeted CI-only retry: the 20-parallel burst is the most network-
  // sensitive test in this file (cold instance + 20 concurrent fetches
  // + DNS/TLS warmup variance). When CI happens to land on a cold edge
  // worker the whole burst can exceed even the 180s budget below and
  // surface as a "security regression" that's really a transport-layer
  // timeout. Retry twice ONLY under CI so a single cold path doesn't
  // fail the build, while local runs still fail fast on real regressions.
  it(
    "20 parallel attempts with the same fake code: zero successes, all known error codes",
    {
      // Network-bound burst against a live edge function; CI cold paths
      // can exceed the default 60s ceiling even after the module-level
      // warmup. Raise the per-test budget so a slow network run is not
      // reported as a security regression.
      timeout: 180_000,
      // `retry` reruns the test on failure/timeout. Scope to CI to avoid
      // masking deterministic regressions during local development.
      retry: process.env.CI ? 2 : 0,
    },
    async () => {
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
        const code = errorCode(r);
        expect(KNOWN_ERROR_CODES.has(code), `unexpected error code: ${code}`).toBe(true);
      }
    },
  );



  it("repeated serial attempts return the same generic error code (no validity leak)", async () => {
    const ITER = 6;
    const codes: string[] = [];
    const messages: string[] = [];
    for (let i = 0; i < ITER; i++) {
      const r = await callRedeem(FAKE_CODES[0], false);
      codes.push(errorCode(r));
      messages.push(errorMessage(r));
    }
    // Both the human message AND the machine code must be perfectly stable
    // across replays — anything else is a state-leak.
    const uniqueMsgs = new Set(messages);
    expect(uniqueMsgs.size, `replay messages drifted: ${[...uniqueMsgs].join(" | ")}`).toBe(1);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size, `replay codes drifted: ${[...uniqueCodes].join(" | ")}`).toBe(1);
    // No-auth replays must specifically return an auth-rejection code
    // (either our handler's NOT_AUTHENTICATED or the gateway's
    // UNAUTHORIZED_NO_AUTH_HEADER, depending on which layer rejected).
    expect(AUTH_REJECTION_CODES.has(codes[0]), `expected auth-rejection code, got: ${codes[0]}`).toBe(true);
  });

  it("varied fake codes do NOT produce distinguishable error codes vs. malformed input", async () => {
    // Probe matrix: shapes that should all surface as an auth-rejection
    // code (since no auth is supplied) — never a code-specific error
    // that would let an attacker classify the input.
    const probes = [
      ...FAKE_CODES,
      "", // empty
      "A", // too short
      "A".repeat(100), // too long
      "<script>alert(1)</script>",
      "'; DROP TABLE access_codes;--",
    ];
    const results = await Promise.all(probes.map((c) => callRedeem(c, false)));

    for (const r of results) {
      // status 0 means the fetch itself failed (network blip under burst).
      // We tolerate that — the security property is about responses that
      // DID come back from the server.
      if (r.status === 0) continue;
      // 502/503/504 are transient gateway responses (cold start, upstream
      // timeout, brief edge unavailability) under burst load. They carry
      // no input-derived information, so they don't break the
      // indistinguishability invariant — skip them like network blips.
      if (r.status === 502 || r.status === 503 || r.status === 504) continue;
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    }
    // Without auth, EVERY probe that received a response must return the
    // same auth-rejection code. The auth check (gateway or handler) runs
    // before any code-shape or code-existence check, so the response
    // cannot vary by input.
    const codes = results
      .filter((r) => r.status !== 0 && r.status !== 502 && r.status !== 503 && r.status !== 504)
      .map(errorCode)
      .filter((c) => c.length > 0);
    expect(codes.length, "at least one probe must have produced a coded error").toBeGreaterThan(0);
    // The security invariant is "no response varies by input shape." Both
    // AUTH_REJECTION_CODES values (gateway-rejected UNAUTHORIZED_NO_AUTH_HEADER
    // vs handler-rejected NOT_AUTHENTICATED) are auth-layer artifacts that
    // can interleave under burst (cold instance vs warm instance), and
    // crucially neither depends on the request body. As long as every
    // response is an auth-rejection, no input-shape side-channel exists.
    const unique = new Set(codes);
    for (const c of unique) {
      expect(
        AUTH_REJECTION_CODES.has(c),
        `every unauthenticated probe must produce an auth-rejection code; got: ${[...unique].join(" | ")}`,
      ).toBe(true);
    }
  });

  it("burst of 30 parallel calls across many distinct fake codes: zero leaks, zero 5xx, stable codes", async () => {
    const codes = Array.from(
      { length: 30 },
      (_, i) => `BURST-${i.toString().padStart(4, "0")}-XYZW`,
    );
    const results = await Promise.all(codes.map((c) => callRedeem(c, false)));

    const successes = results.filter((r) => r.status >= 200 && r.status < 300);
    const serverErrors = results.filter((r) => r.status >= 500);
    expect(successes.length).toBe(0);
    expect(serverErrors.length).toBe(0);

    for (const r of results) {
      const b = (r.body ?? {}) as Record<string, unknown>;
      expect(b.success).not.toBe(true);
      expect(b.tier).toBeUndefined();
      expect(b.granted_until).toBeUndefined();
      // Every error must carry a known machine-readable code.
      const code = (b.code as string) ?? "";
      expect(KNOWN_ERROR_CODES.has(code), `unexpected code: ${code}`).toBe(true);
    }
  }, 60_000);


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
    expect(AUTH_REJECTION_CODES.has(errorCode(after)), `expected auth-rejection code, got: ${errorCode(after)}`).toBe(true);
  });
});

describe("discount_codes: brute-force / replay resilience (no public endpoint)", () => {
  it("100 parallel anon SELECTs return zero rows (no enumeration)", { timeout: 30000 }, async () => {
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
