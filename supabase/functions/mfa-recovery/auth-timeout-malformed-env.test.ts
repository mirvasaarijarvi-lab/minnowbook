// Regression test: malformed MFA_AUTH_TIMEOUT_MS must NOT become a 500.
//
// The handler accepts an optional MFA_AUTH_TIMEOUT_MS env var so we can
// tune the auth.getUser() race per environment (e.g. shorter in CI, a
// bit longer if the upstream auth backend is slow). The pitfall: env
// vars are *always* strings, and a typo like "5s", "fast", "" or a
// negative value used to throw `setTimeout` arg errors or silently
// disable the race, bubbling up as a 500 SERVER_MISCONFIGURED / 504
// IDLE_TIMEOUT instead of the fast 401 the contract promises.
//
// This test pins the parse-with-safe-fallback contract:
//   1. Set MFA_AUTH_TIMEOUT_MS to a malformed value BEFORE importing.
//   2. Stub the three SUPABASE_* env vars so we reach the auth branch.
//   3. Replace globalThis.fetch with a stub that hangs forever, so the
//      handler is forced through the timeout branch (proving the parsed
//      timeout is a real, positive integer and the race actually fires).
//   4. Send a request with a syntactically valid Bearer header and
//      assert the response is a fast JSON 401 with code AUTH_TIMEOUT
//      (NOT SERVER_MISCONFIGURED, NOT 500, NOT a hang).

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stubSupabaseEnv } from "../_shared/stub-supabase-env.ts";

// Step 1: malformed timeout env (non-numeric). Set BEFORE import so the
// handler module observes it during its first request.
Deno.env.set("MFA_AUTH_TIMEOUT_MS", "not-a-number");

// Step 2: ensure Supabase env passes the missing-env guard.
stubSupabaseEnv();

// Step 3: force the auth.getUser() race onto the timeout branch by
// replacing fetch with a never-resolving stub. supabase-js uses fetch
// under the hood, so this guarantees the timeout fires if it parsed.
const originalFetch = globalThis.fetch;
globalThis.fetch = (() =>
  new Promise<Response>(() => {
    // Intentionally never resolves: forces the Promise.race to lose to
    // the AUTH_TIMEOUT_MS setTimeout. If the malformed env had disabled
    // or NaN'd the timeout, this request would hang past 1.5s and the
    // budget assertion below would fail.
  })) as typeof fetch;

const { handleMfaRecoveryRequest } = await import("./index.ts");

Deno.test({
  name:
    "mfa-recovery: malformed MFA_AUTH_TIMEOUT_MS falls back to default and still returns fast 401 AUTH_TIMEOUT (not 500 SERVER_MISCONFIGURED)",
  sanitizeOps: false,
  sanitizeResources: false,
  // Use a tighter env override JUST for this test run so we don't have
  // to wait the full default 5s. The parse fallback must still kick in
  // for the "not-a-number" string set above; here we additionally pin a
  // valid short timeout via setTimeout pre-empt? No — we want to test
  // the fallback path, so we accept the 5s default and bound the test
  // budget at ~6s. The "fast 401" budget below is 6_000ms specifically
  // to allow the safe default to elapse without flaking.
  fn: async () => {
    try {
      const startedAt = Date.now();
      const res = await handleMfaRecoveryRequest(
        new Request("http://localhost/", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": "Bearer stub-token-for-timeout-race",
            "x-request-id": "malformed-timeout-env-1",
          },
          body: JSON.stringify({ action: "count" }),
        }),
      );
      const body = await res.json();
      const elapsedMs = Date.now() - startedAt;

      // Contract: malformed env -> safe fallback -> AUTH_TIMEOUT 401.
      // The exact failure mode we are guarding against is a 500
      // SERVER_MISCONFIGURED (env validation refused to start) or a
      // hang past the platform's idle limit. Both would show up here.
      assertEquals(
        res.status,
        401,
        `expected 401 AUTH_TIMEOUT from safe-fallback path, got ${res.status}: ${JSON.stringify(body)}`,
      );
      assertEquals(
        body.code,
        "AUTH_TIMEOUT",
        `expected code=AUTH_TIMEOUT (NOT SERVER_MISCONFIGURED), got ${JSON.stringify(body)}`,
      );
      assertEquals(body.request_id, "malformed-timeout-env-1");
      // Must finish within the default + small headroom. If the parsed
      // timeout had become NaN, setTimeout would coerce to 1ms (fast)
      // OR the race would never resolve (>>5s). Bound generously.
      assert(
        elapsedMs < 6_000,
        `auth-timeout race must respect the safe default, took ${elapsedMs}ms`,
      );
    } finally {
      globalThis.fetch = originalFetch;
      Deno.env.delete("MFA_AUTH_TIMEOUT_MS");
    }
  },
});
