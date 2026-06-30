// Shared helper for stubbing Supabase env vars in Deno tests.
//
// Why this exists:
// GitHub Actions exports unset `secrets.FOO` as the empty string, not
// undefined. That means `Deno.env.get("SUPABASE_URL") ?? "stub"` keeps the
// "" in place (since "" !== undefined), the handler's missing-env guard
// treats "" as missing, and the test 500s with SERVER_MISCONFIGURED
// instead of exercising whatever it was trying to exercise.
//
// The correct pattern is `||` (falsy fallback), but copy/pasting that into
// every test file invites someone to "fix" it back to `??` later. This
// helper centralizes the contract and is covered by its own unit tests.

const DEFAULT_STUBS: Readonly<Record<string, string>> = {
  SUPABASE_URL: "http://stub.local",
  SUPABASE_ANON_KEY: "stub-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
};

/**
 * Returns `value` unless it's nullish OR an empty/whitespace-only string,
 * in which case `fallback` is returned. This is the contract every
 * `withStubSupabaseEnv` / `stubSupabaseEnv` caller depends on.
 *
 * Exported separately so unit tests can pin the behavior without going
 * through the Deno.env side-effect path.
 */
export function coalesceEnv(
  value: string | null | undefined,
  fallback: string,
): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return fallback;
  if (value.trim().length === 0) return fallback;
  return value;
}

/**
 * Idempotently writes a stub value for `name` into `Deno.env` when the
 * current value is missing, empty, or whitespace. Returns the value that
 * is now visible via `Deno.env.get(name)`.
 *
 * Safe to call multiple times; safe to call from module top-level BEFORE
 * importing a handler that captures env at construction time.
 */
export function stubSupabaseEnvVar(name: string, fallback: string): string {
  const next = coalesceEnv(Deno.env.get(name), fallback);
  Deno.env.set(name, next);
  return next;
}

/**
 * Bulk variant for the standard Supabase trio. Pass overrides only when
 * a test needs non-default stub values; everything else falls back to
 * `DEFAULT_STUBS`.
 *
 * Returns the resolved record so callers can assert on it directly.
 */
export function stubSupabaseEnv(
  overrides: Partial<Record<keyof typeof DEFAULT_STUBS, string>> = {},
): Record<keyof typeof DEFAULT_STUBS, string> {
  const resolved = {} as Record<keyof typeof DEFAULT_STUBS, string>;
  for (const key of Object.keys(DEFAULT_STUBS) as Array<keyof typeof DEFAULT_STUBS>) {
    resolved[key] = stubSupabaseEnvVar(key, overrides[key] ?? DEFAULT_STUBS[key]);
  }
  return resolved;
}

export const __DEFAULT_STUBS_FOR_TEST = DEFAULT_STUBS;
