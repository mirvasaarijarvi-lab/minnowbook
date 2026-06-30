// Regression test: mixed empty-string + unset SUPABASE_* env still
// resolves to a fast 401 (not a 500 SERVER_MISCONFIGURED).
//
// GitHub Actions has TWO ways an env var can arrive "missing":
//   1. `env: FOO: ${{ secrets.UNSET }}` -> Deno.env.get("FOO") === ""
//   2. The var is simply never exported -> Deno.env.get("FOO") === undefined
//
// Real CI workflows mix both shapes (some secrets wired, others not).
// The auth-timeout fallback contract must therefore handle a row like
// `{ URL: "", ANON_KEY: undefined, SERVICE_ROLE_KEY: undefined }` and
// every permutation thereof, otherwise the handler 500s on whichever
// var skipped the `||` rehydration.
//
// This test enumerates all 7 non-trivial mixed permutations of the
// three SUPABASE_* vars across {empty-string, unset}, runs the shared
// `stubSupabaseEnv()` helper for each, and asserts:
//   - every var resolves to a non-empty stub (no "" or undefined leak)
//   - the handler returns a fast JSON 401 (NOT_AUTHENTICATED) under a
//     missing Authorization header, proving the bootstrap made it past
//     the SERVER_MISCONFIGURED guard.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stubSupabaseEnv } from "../_shared/stub-supabase-env.ts";

// Seed at module load so the handler's first import sees a valid env.
// Per-case mutation happens inside each test below.
stubSupabaseEnv();

const { handleMfaRecoveryRequest } = await import("./index.ts");

type EnvShape = "empty" | "unset";
const VAR_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function applyShape(name: typeof VAR_NAMES[number], shape: EnvShape) {
  if (shape === "empty") Deno.env.set(name, "");
  else Deno.env.delete(name);
}

// All 8 permutations of {empty, unset}^3, minus the trivially-uniform
// {empty,empty,empty} case already covered by auth-timeout-empty-env.test.ts.
const PERMUTATIONS: Array<Record<typeof VAR_NAMES[number], EnvShape>> = [];
for (const u of ["empty", "unset"] as const) {
  for (const a of ["empty", "unset"] as const) {
    for (const s of ["empty", "unset"] as const) {
      if (u === "empty" && a === "empty" && s === "empty") continue;
      PERMUTATIONS.push({
        SUPABASE_URL: u,
        SUPABASE_ANON_KEY: a,
        SUPABASE_SERVICE_ROLE_KEY: s,
      });
    }
  }
}

for (const shape of PERMUTATIONS) {
  const label = VAR_NAMES.map((n) => `${n}=${shape[n]}`).join(", ");
  Deno.test({
    name: `mfa-recovery: mixed missing-env permutation [${label}] -> stubs rehydrate and handler returns fast 401`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
      // Arrange: apply the per-var shape (empty string vs fully unset).
      for (const name of VAR_NAMES) applyShape(name, shape[name]);

      // Act: run the shared helper. Empty AND unset must both be coerced.
      const resolved = stubSupabaseEnv();

      // Assert: every var is a non-empty stub, and Deno.env.get agrees.
      for (const name of VAR_NAMES) {
        const live = Deno.env.get(name);
        assert(
          typeof live === "string" && live.trim().length > 0,
          `${name} (${shape[name]}) must be rehydrated to a non-empty stub, got ${JSON.stringify(live)}`,
        );
        assertEquals(
          live,
          resolved[name],
          `${name} resolved value must match Deno.env.get after stubbing`,
        );
      }

      // Act + assert: handler must reach the missing-auth 401 path, not
      // the SERVER_MISCONFIGURED 500 path. A 500 here means at least one
      // of the three vars slipped through the fallback for this shape.
      const requestId = `mixed-env-${shape.SUPABASE_URL}-${shape.SUPABASE_ANON_KEY}-${shape.SUPABASE_SERVICE_ROLE_KEY}`;
      const startedAt = Date.now();
      const res = await handleMfaRecoveryRequest(
        new Request("http://localhost/", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-request-id": requestId,
          },
          body: JSON.stringify({ action: "count" }),
        }),
      );
      const body = await res.json();
      const elapsedMs = Date.now() - startedAt;

      assertEquals(
        res.status,
        401,
        `expected fast 401 NOT_AUTHENTICATED for [${label}], got ${res.status}: ${JSON.stringify(body)}`,
      );
      assertEquals(
        body.code,
        "NOT_AUTHENTICATED",
        `expected NOT_AUTHENTICATED (NOT SERVER_MISCONFIGURED) for [${label}], got ${JSON.stringify(body)}`,
      );
      assertEquals(body.request_id, requestId);
      assert(
        elapsedMs < 1_500,
        `missing-auth short-circuit must be <1.5s for [${label}], took ${elapsedMs}ms`,
      );
    },
  });
}

// Restore real SUPABASE_* env vars at end of file so subsequent live
// integration tests in the same `deno test` process see the real env
// instead of the stubs we installed above.
import { restoreSupabaseEnv as __restoreSupabaseEnv } from "../_shared/stub-supabase-env.ts";
Deno.test("_zz_restore_supabase_env_for_subsequent_files", () => {
  __restoreSupabaseEnv();
});
