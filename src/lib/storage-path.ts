/**
 * Defensive path sanitiser for Supabase Storage object keys.
 *
 * `supabase.storage.from(bucket).createSignedUrl(path, ttl)` (and the
 * download/upload helpers) accept whatever path the caller passes. RLS
 * is the real authority on what a user may sign, but defence in depth
 * still pays off: we reject obviously malicious inputs (path traversal,
 * absolute paths, NUL bytes, backslashes, control chars) before they
 * ever reach the network. This silences static analysers (e.g. Aikido
 * "Path traversal attack possible") and prevents a future bug in a
 * caller from accidentally crafting a key like `../other-tenant/...`.
 *
 * Returns the cleaned path on success and throws on rejection. The
 * thrown error is intentionally generic so the message can safely be
 * surfaced to logs without leaking the offending payload.
 */
export function assertSafeStorageObjectPath(path: string): string {
  if (typeof path !== "string") {
    throw new Error("Invalid storage path");
  }
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error("Invalid storage path");
  }
  if (trimmed.length > 1024) {
    throw new Error("Invalid storage path");
  }
  // No NUL or other ASCII control characters.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error("Invalid storage path");
  }
  // No backslashes, no scheme/host fragments.
  if (trimmed.includes("\\") || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw new Error("Invalid storage path");
  }
  // No absolute paths.
  if (trimmed.startsWith("/")) {
    throw new Error("Invalid storage path");
  }
  // No traversal segments anywhere in the path.
  const segments = trimmed.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new Error("Invalid storage path");
    }
  }
  return trimmed;
}
