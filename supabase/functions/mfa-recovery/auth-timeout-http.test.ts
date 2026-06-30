// HTTP-layer integration test for the empty-CI-secrets 401 contract.
//
// The sibling `auth-timeout-empty-env.test.ts` proves the in-process
// handler short-circuits to JSON 401 when the three SUPABASE_* env vars
// arrive as the empty string (the GitHub Actions unset-secret shape).
// This test is one layer wider: it goes through `Deno.serve` so we
// exercise the same request/response pipeline the Supabase Functions
// runtime uses in production. A regression that, say, threw inside the
// top-level module body would surface here as a connect failure instead
// of a silent 200/500 from the direct handler call.
//
// Sequence:
//   1. Set the three SUPABASE_* env vars to "" BEFORE importing the
//      handler module (matches `secrets: ${{ secrets.FOO }}` semantics).
//   2. Apply the shared `stubSupabaseEnv()` helper so the `||` fallback
//      rehydrates them to in-memory stubs (a `??` regression would
//      leave "" in place and the test would observe a 500 here).
//   3. Boot `Deno.serve(handleMfaRecoveryRequest)` on an ephemeral port
//      using an AbortController so the test cleans up after itself.
//   4. POST to the live socket with NO Authorization header and assert
//      the fast JSON 401 contract: status, body shape, request_id echo,
//      and <1.5s budget.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stubSupabaseEnv } from "../_shared/stub-supabase-env.ts";

// Step 1: simulate `secrets.SUPABASE_*` arriving as empty strings.
Deno.env.set("SUPABASE_URL", "");
Deno.env.set("SUPABASE_ANON_KEY", "");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "");

// Step 2: rehydrate to stub values via the shared helper.
stubSupabaseEnv();

const { handleMfaRecoveryRequest } = await import("./index.ts");

Deno.test({
  name:
    "mfa-recovery HTTP: empty-string CI secrets -> live server returns fast JSON 401 with request_id echo",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // Step 3: boot a private server on an ephemeral port so we don't
    // collide with the module-level Deno.serve(...) on :8000 or with
    // other tests running in parallel.
    const controller = new AbortController();
    const server = Deno.serve(
      { port: 0, signal: controller.signal, onListen: () => {} },
      handleMfaRecoveryRequest,
    );
    const { port } = server.addr as Deno.NetAddr;

    try {
      // Step 4: hit the live socket without an Authorization header.
      const requestId = "http-empty-env-regression-1";
      const startedAt = Date.now();
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
        },
        body: JSON.stringify({ action: "count" }),
      });
      const body = await res.json();
      const elapsedMs = Date.now() - startedAt;

      assertEquals(
        res.status,
        401,
        `expected fast 401 from missing-auth guard over HTTP, got ${res.status}: ${JSON.stringify(body)}`,
      );
      assertEquals(
        res.headers.get("content-type")?.includes("application/json"),
        true,
        "401 response must be JSON",
      );
      assertEquals(
        res.headers.get("x-request-id"),
        requestId,
        "x-request-id must round-trip through the HTTP layer",
      );
      // Body shape: standardized error envelope ({error, code, request_id}).
      assertEquals(body.code, "NOT_AUTHENTICATED");
      assertEquals(body.request_id, requestId);
      assert(
        typeof body.error === "string" && body.error.length > 0,
        `expected error message in body, got ${JSON.stringify(body)}`,
      );
      assert(
        elapsedMs < 1_500,
        `HTTP missing-auth short-circuit must be <1.5s, took ${elapsedMs}ms`,
      );
    } finally {
      controller.abort();
      await server.finished;
    }
  },
});
