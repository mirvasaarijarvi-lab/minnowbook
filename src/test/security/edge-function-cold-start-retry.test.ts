/**
 * Targeted e2e: the cold-start retry helper, after absorbing a
 * simulated 503 on the first attempt, must deliver a POST response
 * that carries the correct CORS headers and the expected JSON payload
 * from the live `public-booking` warmup branch.
 *
 * This pins two invariants together:
 *   1. `fetchWithColdStartRetry` actually retries on 503 (the first
 *      synthetic 503 is consumed; the retry hits the real network).
 *   2. The retried response is the real edge function response (not
 *      the synthetic 503), so its CORS headers and JSON body match
 *      what the warmup branch is contractually required to return.
 *
 * If either invariant regresses, this single test fails fast in CI
 * with a clear message, instead of leaving cold-start flakiness to
 * be misdiagnosed elsewhere in the gate.
 */
import "@/test/setup";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithColdStartRetry } from "./cold-start-retry";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const ENDPOINT = `${SUPABASE_URL}/functions/v1/public-booking`;

describe("cold-start retry e2e: POST follow-up after simulated 503", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    "returns 200 with warmup payload and CORS headers after a single 503 retry",
    async () => {
      const realFetch = globalThis.fetch.bind(globalThis);
      let callCount = 0;

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
          callCount += 1;
          if (callCount === 1) {
            // Simulate a cold-start gateway blip on the very first attempt.
            return new Response("upstream cold start", {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "content-type": "text/plain" },
            });
          }
          // Subsequent attempts pass through to the real edge function.
          return realFetch(input as never, init);
        });

      const res = await fetchWithColdStartRetry(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://minnowbook.lovable.app",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          "x-warmup-source": "vitest:cold-start-retry.test",
        },
        body: JSON.stringify({ warmup: true }),
      });

      // The helper must have retried exactly once after the synthetic 503.
      expect(
        fetchSpy.mock.calls.length,
        `expected exactly 2 fetch attempts (1 synthetic 503 + 1 real), got ${fetchSpy.mock.calls.length}`,
      ).toBe(2);

      // The returned response must be the REAL edge function response,
      // not the synthetic 503 we injected.
      expect(
        res.status,
        `expected retried POST to be 200, got ${res.status}`,
      ).toBe(200);

      // Payload contract from the warmup branch.
      const body = await res.json();
      expect(body).toMatchObject({ ok: true, warmup: true });
      expect(typeof body.request_id).toBe("string");
      expect(body.request_id.length).toBeGreaterThan(0);

      // CORS contract: ACAO must be set (echoed allowed origin, never
      // wildcard or attacker-controlled), credentials must not leak.
      const acao = res.headers.get("access-control-allow-origin");
      expect(acao, "ACAO header missing from retried response").toBeTruthy();
      expect(acao).not.toBe("*");
      expect(acao).not.toBe("");

      const acac = res.headers.get("access-control-allow-credentials");
      if (acac !== null) {
        expect(acac.toLowerCase()).not.toBe("true");
      }

      // Warmup identification headers must survive the retry path.
      expect(res.headers.get("x-warmup")).toBe("true");
      expect(res.headers.get("x-request-id")).toBeTruthy();
    },
    30_000,
  );
});
