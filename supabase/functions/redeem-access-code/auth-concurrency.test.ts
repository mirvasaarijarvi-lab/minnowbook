// Integration test: when the Authorization header is missing, the
// redeem-access-code handler must short-circuit to a fast 401 even
// under burst concurrency. This locks in the property that an
// unauthenticated flood cannot consume rate-limiter capacity or
// trigger the slow auth-verification path.
//
// We intentionally fire the requests in parallel (Promise.all) to
// exercise any per-request shared state in the handler closure
// (e.g. adminClientRef, lastLimiterDecision, requestId) and to
// guarantee that none of them block on the 5s getClaims() budget.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRedeemAccessCodeRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

const CONCURRENCY = 20;
// Per-request budget. The 5s auth-verify cap in require-auth would
// blow this out immediately if the unauth path ever fell through to
// it. Real unauth rejection is synchronous, so this leaves ample
// headroom for CI jitter.
const PER_REQUEST_BUDGET_MS = 1_500;
// Total wall-clock budget for the whole burst. Even at 20x
// concurrency the handler is fully synchronous on the unauth branch,
// so the entire batch must clear in well under one auth-verify
// timeout window.
const BATCH_BUDGET_MS = 3_000;

function makeUnauthenticatedRequest(i: number): Request {
  return new Request("https://example.test/redeem-access-code", {
    method: "POST",
    headers: {
      // Deliberately NO Authorization header. Content-Type is set so
      // the handler does not bail on body parsing before auth.
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
      "X-Test-Burst-Index": String(i),
    },
    body: JSON.stringify({ code: "BURST-TEST" }),
  });
}

Deno.test(
  "redeem-access-code: missing Authorization fast-fails 401 under concurrent burst",
  withStubSupabaseEnv(async () => {
    const startedAt = performance.now();

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) => {
        const t0 = performance.now();
        return handleRedeemAccessCodeRequest(makeUnauthenticatedRequest(i))
          .then(async (res) => {
            const elapsed = performance.now() - t0;
            const bodyText = await res.text();
            return { res, elapsed, bodyText, i };
          });
      }),
    );

    const totalElapsed = performance.now() - startedAt;

    // Whole-batch wall-clock guard. If this trips, the unauth path
    // is no longer synchronous and is likely hitting the auth-verify
    // network call or some other shared serialization point.
    if (totalElapsed > BATCH_BUDGET_MS) {
      throw new Error(
        `unauthenticated burst took ${totalElapsed.toFixed(0)}ms ` +
          `(budget ${BATCH_BUDGET_MS}ms) for ${CONCURRENCY} requests`,
      );
    }

    for (const { res, elapsed, bodyText, i } of results) {
      // 1. Status must be 401 every time.
      assertEquals(
        res.status,
        401,
        `request #${i} returned ${res.status}, expected 401. body=${bodyText}`,
      );

      // 2. Each request individually must clear the per-request
      //    fast-fail budget. A regression to the slow path would
      //    push at least one request well past this.
      if (elapsed > PER_REQUEST_BUDGET_MS) {
        throw new Error(
          `request #${i} took ${elapsed.toFixed(0)}ms ` +
            `(budget ${PER_REQUEST_BUDGET_MS}ms)`,
        );
      }

      // 3. JSON error contract: code === NOT_AUTHENTICATED.
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        throw new Error(
          `request #${i} returned non-JSON body: ${bodyText.slice(0, 200)}`,
        );
      }
      assertEquals(
        parsed.code,
        "NOT_AUTHENTICATED",
        `request #${i} returned wrong error code: ${JSON.stringify(parsed)}`,
      );

      // 4. Security headers must be present on the fast-fail path
      //    too — a regression here would weaken the CSP/HSTS floor
      //    specifically for unauthenticated traffic.
      assertSharedHeaders(res, `burst #${i}`);
      assertCspAndHsts(res, `burst #${i}`);

      await drainBody(res);
    }
  }),
);
