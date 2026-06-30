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
//
// Cross-file pollution guard:
// Deno runs all test files discovered by `deno test` in a single process,
// so any `Deno.env.set(...)` here persists into subsequent test files.
// We snapshot the original values on first call and expose
// `restoreSupabaseEnv()` so test files that stub env can put it back
// before live integration tests run later in the same process.

const DEFAULT_STUBS: Readonly<Record<string, string>> = {
  SUPABASE_URL: "http://stub.local",
  SUPABASE_ANON_KEY: "stub-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
};

const TRACKED_KEYS = Object.keys(DEFAULT_STUBS) as Array<
  keyof typeof DEFAULT_STUBS
>;

// Snapshot of the *very first* observed values, taken before any stub
// helper mutates Deno.env. `undefined` means the var was unset.
const ORIGINAL_ENV: Partial<Record<keyof typeof DEFAULT_STUBS, string | undefined>> = {};
let snapshotted = false;

function snapshotOnce(): void {
  if (snapshotted) return;
  for (const k of TRACKED_KEYS) {
    ORIGINAL_ENV[k] = Deno.env.get(k);
  }
  snapshotted = true;
}

// Snapshot at module load so the real env (loaded from .env or CI
// secrets) is captured BEFORE any test code mutates Deno.env. Without
// this, a unit test that sets a var to "" before calling stubSupabaseEnv
// would burn that "" into the "original" snapshot and restoreSupabaseEnv
// would put "" back — defeating cross-file restoration.
snapshotOnce();

/**
 * Returns `value` unless it's nullish OR an empty/whitespace-only string,
 * in which case `fallback` is returned. This is the contract every
 * `withStubSupabaseEnv` / `stubSupabaseEnv` caller depends on.
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

export function stubSupabaseEnvVar(name: string, fallback: string): string {
  snapshotOnce();
  const next = coalesceEnv(Deno.env.get(name), fallback);
  Deno.env.set(name, next);
  return next;
}

export function stubSupabaseEnv(
  overrides: Partial<Record<keyof typeof DEFAULT_STUBS, string>> = {},
): Record<keyof typeof DEFAULT_STUBS, string> {
  snapshotOnce();
  const resolved = {} as Record<keyof typeof DEFAULT_STUBS, string>;
  for (const key of TRACKED_KEYS) {
    resolved[key] = stubSupabaseEnvVar(key, overrides[key] ?? DEFAULT_STUBS[key]);
  }
  return resolved;
}

/**
 * Restores the tracked SUPABASE_* env vars to whatever they were the very
 * first time `stubSupabaseEnv` / `stubSupabaseEnvVar` ran in this process.
 * Vars that were unset at snapshot time are deleted again. Safe to call
 * multiple times; no-op when nothing has been stubbed.
 *
 * Test files that stub env at module-top MUST call this (typically via a
 * final `Deno.test` that sorts last in the file) so later live
 * integration tests in the same `deno test` invocation see the real env.
 */
export function restoreSupabaseEnv(): void {
  if (!snapshotted) return;
  for (const k of TRACKED_KEYS) {
    const original = ORIGINAL_ENV[k];
    if (original === undefined) {
      Deno.env.delete(k);
    } else {
      Deno.env.set(k, original);
    }
  }
}

export const __DEFAULT_STUBS_FOR_TEST = DEFAULT_STUBS;
