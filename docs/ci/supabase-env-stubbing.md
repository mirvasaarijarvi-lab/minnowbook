# CI Checklist: Supabase Env Stubbing

Use this checklist whenever you add or modify an edge function test, a CI workflow, or
the shared stubbing helpers. Its purpose is to prevent the regression where
`createClient(...)` throws `"supabaseKey is required"` at module-import time and turns
an expected 401 into a 500.

## Background

- `@supabase/supabase-js` throws synchronously when `SUPABASE_URL` or the anon/service
  key is missing **or an empty string**.
- GitHub Actions masks secrets by exporting them as empty strings on forks / unprivileged
  runs. An "unset" check (`if (!process.env.X)`) is correct; a "defined" check
  (`if (process.env.X !== undefined)`) is **not**.
- Auth must short-circuit **before** any `createClient(...)` call, otherwise a missing
  Authorization header surfaces as a 500.

## Checklist (per PR)

### 1. Handler code
- [ ] `Authorization` header is validated (presence + `Bearer ` prefix) **before**
      `createClient` runs.
- [ ] `createClient` is called inside the request handler, not at module top-level.
- [ ] On missing/invalid auth, return via `unauthorized(...)` from
      `supabase/functions/_shared/errors.ts` (consistent JSON + `x-request-id`).

### 2. Test setup
- [ ] Tests wrap handler invocations in `withStubSupabaseEnv(...)` from
      `supabase/functions/_shared/test-security-headers.ts`.
- [ ] Do **not** read env vars at module top-level in the test file. Read them
      inside the test body, after `withStubSupabaseEnv` has run.
- [ ] When stubbing `globalThis.fetch` to simulate hanging auth, install the stub
      **before** the dynamic `import()` of the handler, so `supabase-js` captures
      the wrapped fetch.
- [ ] Every `await fetch(...)` in tests is followed by `await res.text()` (or
      `.json()`) to avoid Deno resource leaks.

### 3. Shared helpers (do not regress)
- [ ] `coerceMissingEnv()` continues to treat `undefined`, `""`, and whitespace as
      missing.
- [ ] `withStubSupabaseEnv()` overwrites inherited empty strings with stub values
      and restores the prior values on teardown.
- [ ] Unit tests in `supabase/functions/_shared/test-security-headers.test.ts` still
      pass.

### 4. Coverage gates (must stay green)
- `supabase/functions/_shared/security-headers-coverage.test.ts` — every function
  directory has a `security-headers-integration.test.ts`.
- `supabase/functions/_shared/auth-401-contract.test.ts` — every auth-enforced
  handler returns a fast JSON 401 on missing/malformed Authorization.
- `supabase/functions/_shared/auth-401-no-env.test.ts` — same, but with the
  Supabase env vars inherited as empty strings.
- `supabase/functions/_shared/inherited-empty-env-regression.test.ts` — explicit
  regression for the empty-string env case.
- `.github/workflows/auth-short-circuit-gate.yml` — PR gate for the above.

### 5. CI workflow changes
- [ ] New workflows that exercise edge functions either provide real Supabase
      secrets **or** rely on `withStubSupabaseEnv` in the test setup.
- [ ] Never `export SUPABASE_ANON_KEY=""` (or similar) in a workflow step; leave
      the variable unset so `coerceMissingEnv` can do its job.

## When a failure recurs

1. Confirm the failing response is 500 (not 401). A 500 with
   `"supabaseKey is required"` in the logs ⇒ this checklist item failed.
2. Identify which step exported an empty string, or which handler called
   `createClient` before validating auth.
3. Add the missing case to
   `supabase/functions/_shared/inherited-empty-env-regression.test.ts` so the
   regression is caught next time.
