# Signed URL Error Contract

## What this is (plain English)

Right now, when something goes wrong while creating a signed URL for a private file (offer PDF, attachment, branding asset, etc.), the code throws a generic `Error` with a free-form message like "Failed to create signed URL for foo: fetch failed". That's a problem because:

- The UI can't tell the difference between "user is logged out" (403), "file doesn't exist" (404), "bad path" (400), and "Storage is having a bad day" (transport error).
- The security tests can only do fuzzy regex matching on error messages, which is why we keep tweaking that regex every time CI gets flaky.
- We can't show the user a friendly, actionable message.

An "error contract" means: every signed URL failure returns the same shape with a stable machine-readable `code` (e.g. `"forbidden"`, `"not_found"`, `"invalid_path"`, `"transport"`, `"unknown"`) plus a human message. Production code switches on the `code`, tests assert on the `code`, and the message is free to change without breaking anything.

## Files to change

### 1. `src/lib/signed-url-error.ts` (new)

Define the contract in one place:

```ts
export type SignedUrlErrorCode =
  | "invalid_path"     // assertSafeStorageObjectPath rejected the input
  | "forbidden"        // RLS denial, anon, non-member
  | "not_found"        // bucket / object missing
  | "transport"        // fetch failed, timeout, DNS, etc.
  | "unknown";         // anything we couldn't classify

export class SignedUrlError extends Error {
  readonly code: SignedUrlErrorCode;
  readonly httpStatus?: number;
  readonly cause?: unknown;
  constructor(code, message, opts?: { httpStatus?; cause? }) { ... }
}

export function isSignedUrlError(e: unknown): e is SignedUrlError;
export function classifySignedUrlFailure(input: {
  sdkError?: { message?: string; status?: number } | null;
  thrown?: unknown;
}): SignedUrlError;
```

Classification rules:
- Thrown with `name === "InvalidStoragePathError"` -> `invalid_path`
- HTTP 401/403 OR message matches `/permission|denied|policy|not allowed|unauthor/i` -> `forbidden`
- HTTP 404 OR message matches `/not\s*found|object.*missing|no such/i` -> `not_found`
- Thrown `TypeError` / message matches `/fetch failed|network|timeout|abort|ECONN/i` -> `transport`
- Else -> `unknown`

### 2. `src/lib/tenant-private-url.ts`

Replace the generic throw in `mintSignedUrl` with `classifySignedUrlFailure(...)`. Wrap the `assertSafeStorageObjectPath` call in a try/catch that re-throws as `SignedUrlError("invalid_path", ...)`. Wrap the `createSignedUrl` call in try/catch so transport throws are classified instead of propagated raw.

### 3. `src/lib/tenant-private-url.test.ts`

Add cases asserting:
- Bad path -> `SignedUrlError` with `code === "invalid_path"`
- Mocked SDK 403 -> `code === "forbidden"`, `httpStatus === 403`
- Mocked SDK 404 -> `code === "not_found"`
- Mocked thrown `TypeError("fetch failed")` -> `code === "transport"`
- Cache is dropped after a classified failure (existing invariant, just re-asserted)

### 4. `src/test/security/tenant-assets-private.test.ts`

Replace the regex-on-message assertion in the `createSignedUrl` denial test with an assertion on the new contract:

```ts
const err = await safeAnonCreateSignedUrl(...);
// We don't care about wording; we care that it's a known-denied code.
expect(["forbidden", "not_found"]).toContain(classifySignedUrlFailure({ sdkError: err.error }).code);
```

The CI-mock branch in `safeAnonCreateSignedUrl` keeps alternating `403`/`404` so both `forbidden` and `not_found` are exercised. The diagnostic logging stays.

### 5. Callers (UI surface for the new code)

Search-and-update the small number of `catch (e)` sites that consume `createTenantPrivateSignedUrl` so they branch on `isSignedUrlError(e) && e.code === "forbidden"` to show "You don't have access to this file" vs. `"transport"` to show "Network problem, try again". No new translations in this PR — strings stay in English at the call site, slotted into the existing toast helpers. (I'll list the exact files after grepping in implementation; expected: `OffersManager`, anywhere using `createTenantPrivateSignedUrl(s)`.)

## Out of scope

- Renaming the bucket helpers.
- Changing the cache behavior.
- New i18n keys (can follow up).
- The `tenant-branding` (public) bucket — it has no signed URL flow.

## Risk / rollout

- Pure additive: existing `try/catch (e)` sites that only read `e.message` keep working because `SignedUrlError extends Error`.
- Tests get stricter (assert on `code`, not regex), so a future regression that changes wording won't silently pass.
