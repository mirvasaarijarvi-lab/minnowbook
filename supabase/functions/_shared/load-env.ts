// Non-strict dotenv loader for Deno tests.
//
// `https://deno.land/std@0.224.0/dotenv/load.ts` does an `assertSafe` check
// against `.env.example` and throws `MissingEnvVarsError` when the runtime
// `.env` (or process env) does not declare every key listed in the example.
// In CI this hard-fails every test that imports it, even though the test
// itself only needs a couple of vars and falls back to `VITE_*` aliases.
//
// We intentionally skip the example-file check here. Tests that require a
// specific var should validate it themselves (e.g. `requireEnv(...)`) and
// `Deno.test({ ignore: ... })` out cleanly when missing.
import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

try {
  loadSync({
    export: true,
    examplePath: null,
    allowEmptyValues: true,
  });
} catch {
  // No .env present in CI — that's fine, real env vars are already injected.
}
