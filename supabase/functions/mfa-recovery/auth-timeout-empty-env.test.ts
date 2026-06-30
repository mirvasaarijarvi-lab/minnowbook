// Regression test for the empty-string CI secret pitfall.
//
// GitHub Actions exports unset `secrets.FOO` as the literal empty string
// rather than leaving the env var undefined. Earlier revisions of
// `auth-timeout.test.ts` used `??` to default the stub env, which only
// fires for `undefined`. The result was that CI runs with unset Supabase
// secrets propagated "" into the handler, the missing-env guard treated
// "" as missing, and the test failed with a 500 SERVER_MISCONFIGURED
// instead of exercising the 5s auth.getUser() race we actually care about.
//
// This test pins the `||` fallback contract so we never regress:
//   1. Simulate the CI environment by setting the three Supabase env vars
//      to the empty string BEFORE the handler module is imported.
//   2. Re-apply the same `|| "stub"` fallback the timeout test uses.
//   3. Assert Deno.env.get now returns the stub (not "").
//   4. Hit the handler with a missing Authorization header and assert it
//      short-circuits to a fast JSON 401, proving the env bootstrap made
//      it past the missing-env 500 guard.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stubSupabaseEnv } from "../_shared/stub-supabase-env.ts";

// Step 1: simulate `secrets.SUPABASE_*` being unset in GitHub Actions.
Deno.env.set("SUPABASE_URL", "");
Deno.env.set("SUPABASE_ANON_KEY", "");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "");

// Step 2: apply the shared helper (which uses the empty-string-aware
// `coalesceEnv` rule, NOT `??`).
stubSupabaseEnv();

const { handleMfaRecoveryRequest } = await import("./index.ts");

Deno.test({
  name:
    "mfa-recovery: empty-string CI secrets -> `||` fallback rehydrates stubs and handler reaches 401 path (not 500)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // Step 3: empty-string env must have been coerced to the stub values.
    assertEquals(
      Deno.env.get("SUPABASE_URL"),
      "http://stub.local",
      "`||` must replace empty-string env with the stub; `??` would leave \"\" in place",
    );
    assertEquals(Deno.env.get("SUPABASE_ANON_KEY"), "stub-anon-key");
    assertEquals(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      "stub-service-key",
    );

    // Step 4: with stubs in place and NO Authorization header, the handler
    // must take the fast auth-missing 401 path. A 500 here would mean the
    // env bootstrap regressed and tripped SERVER_MISCONFIGURED.
    const startedAt = Date.now();
    const res = await handleMfaRecoveryRequest(
      new Request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "empty-env-regression-1",
        },
        body: JSON.stringify({ action: "count" }),
      }),
    );
    const body = await res.text();
    const elapsedMs = Date.now() - startedAt;

    assertEquals(
      res.status,
      401,
      `expected fast 401 from missing-auth guard, got ${res.status}: ${body}`,
    );
    assert(
      elapsedMs < 1_500,
      `missing-auth short-circuit must be <1.5s, took ${elapsedMs}ms`,
    );
    assertEquals(res.headers.get("x-request-id"), "empty-env-regression-1");
  },
});
