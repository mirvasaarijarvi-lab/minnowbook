// Test-only helper: snapshot backend settings before a test changes them and
// always put them back afterwards, even when the test throws or an assertion
// fails. Deno runs every test file in one process, so a leaked fake address
// would make later live tests call a backend that does not exist.
export const BACKEND_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function snapshotEnv(keys: readonly string[] = BACKEND_ENV_KEYS): () => void {
  const saved = keys.map((k) => [k, Deno.env.get(k)] as const);
  return () => {
    for (const [k, v] of saved) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  };
}

export function withRestoredEnv<T>(
  fn: () => Promise<T> | T,
  keys: readonly string[] = BACKEND_ENV_KEYS,
): () => Promise<T> {
  return async () => {
    const restore = snapshotEnv(keys);
    try {
      return await fn();
    } finally {
      restore();
    }
  };
}
