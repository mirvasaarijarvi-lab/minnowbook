## Goal

Eliminate per-function duplication of CORS + transport-security header objects so future drift (like the recent `public-booking` `cors` vs `corsHeaders` regression) becomes structurally impossible. Today the same `Strict-Transport-Security` / `Referrer-Policy` / `CSP` triad and origin allowlist are copy-pasted into 21 edge functions, in 3 slightly different shapes:

- 13 functions inline a `const corsHeaders = { ... }` literal.
- 8 functions define a local `function getCorsHeaders(req)` that returns the same shape (some with origin allowlisting).
- `public-booking` adds a `cors` parameter rebinding for its service-role guard.

## What to build

1. **New shared module: `supabase/functions/_shared/http-headers.ts`**

   Exports:
   - `SECURITY_HEADERS` — the immutable transport-security triad + `X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control`, `Pragma`, `Vary`.
   - `DEFAULT_ALLOWED_ORIGINS` — the canonical Lovable / mimmobook list (string + regex entries).
   - `isOriginAllowed(origin, allowlist?)`.
   - `getCorsHeaders(req, opts?)` — single source of truth. Options cover the existing variations:
     - `allowOrigins?: (string | RegExp)[]` (default `DEFAULT_ALLOWED_ORIGINS`)
     - `allowHeaders?: string` (default current canonical list; redeem-access-code adds `idempotency-key`)
     - `allowMethods?: string`
     - `allowCredentials?: boolean`
     - `extraHeaders?: Record<string, string>`
   - `corsHeaders` — a static fallback bag for the rare functions that do not have a `Request` in scope (cron entrypoints, top-of-file constants). It is `{ "Access-Control-Allow-Origin": "*", ...SECURITY_HEADERS, ...defaultAllowHeaders }`.

2. **Migrate all 21 edge functions to import from the shared module.**

   Each `index.ts` keeps a tiny local re-export so the static security scanner still sees the literal symbol names it greps for:

   ```ts
   import { getCorsHeaders, corsHeaders } from "../_shared/http-headers.ts";
   ```

   - The 13 inline-`corsHeaders` functions: delete the literal, keep `corsHeaders` import.
   - The 8 `getCorsHeaders` functions: delete the local function + ALLOWED_ORIGINS, keep the import. Pass `{ allowHeaders: "...idempotency-key..." }` for `redeem-access-code` and `{ allowOrigins: [...with mimmobook + lovableproject] }` for `support-chat`.
   - `public-booking`: replace the inline `corsHeaders` with the import. Keep the `cors` parameter on `assertServiceRoleKey` (defaults to `corsHeaders`) since the test already accepts that rebinding.

3. **Update the static scanner `src/test/security/edge-function-hsts-referrer-csp.test.ts`** so it remains the gatekeeper but follows the import.

   - When an `index.ts` imports from `_shared/http-headers.ts`, concatenate that shared file's source into the scanned text before running the existing `Strict-Transport-Security` / `Referrer-Policy` / `Content-Security-Policy` regex assertions.
   - Leave the `new Response(...)` spread heuristic unchanged. It already accepts `...corsHeaders`, `...getCorsHeaders(`, and `...cors`.

4. **Lock it in with a new unit test: `supabase/functions/_shared/http-headers.test.ts`**

   - `getCorsHeaders` returns HSTS ≥ 180 days with `includeSubDomains`.
   - `Referrer-Policy` is `strict-origin-when-cross-origin`.
   - CSP includes `default-src 'none'` and `frame-ancestors 'none'`.
   - Allowed origin is echoed back; disallowed origin falls back to the first allowlist entry (or is omitted when the per-call policy says so).
   - `idempotency-key` opt-in is honored.

## Out of scope

- No business-logic changes inside any edge function.
- No changes to `supabase/config.toml` or function deployment settings.
- No change to which origins are allowed in production (the canonical list is preserved exactly).

## Validation

- `bunx vitest run src/test/security/edge-function-hsts-referrer-csp.test.ts` — must stay green for all 21 functions.
- `bunx vitest run supabase/functions/_shared/http-headers.test.ts` — new tests pass.
- Spot-deploy `public-booking` and `admin-users` after the refactor and curl them to confirm headers are unchanged.

## Technical notes

- The scanner currently reads only `index.ts` per function. Following the import is the smallest change that lets us actually delete the duplicated literals; the alternative (keeping the literals in every file "for the scanner") would defeat the entire refactor.
- `public-booking` uses `Access-Control-Allow-Origin: *` today (no allowlist). The migration preserves that by passing `{ allowOrigins: "*" }` rather than silently tightening it; tightening is a separate decision.
- The shared module lives under `_shared/`, which the scanner already excludes from its function discovery (`!name.startsWith("_")`), so it will not be scanned as a standalone function.
