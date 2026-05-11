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
 * Returns the cleaned path on success and throws `InvalidStoragePathError`
 * on rejection. Callers can branch on `isInvalidStoragePathError(err)`
 * (or use `getFriendlyStoragePathErrorMessage`) to surface a safe,
 * user-friendly toast instead of a generic upload-failed message.
 */

/** Typed error thrown when a Storage object key fails sanitisation. */
export class InvalidStoragePathError extends Error {
  /** Stable discriminator so error shapes survive bundler renames. */
  readonly code = "INVALID_STORAGE_PATH" as const;
  /** Short reason tag, useful for logs. Never includes the offending value. */
  readonly reason: string;
  constructor(reason: string) {
    super("Invalid storage path");
    this.name = "InvalidStoragePathError";
    this.reason = reason;
  }
}

/** Type guard for caller branching. Tolerant of cross-realm errors. */
export function isInvalidStoragePathError(err: unknown): err is InvalidStoragePathError {
  if (!err || typeof err !== "object") return false;
  if (err instanceof InvalidStoragePathError) return true;
  return (err as { code?: unknown }).code === "INVALID_STORAGE_PATH";
}

export function assertSafeStorageObjectPath(path: string): string {
  if (typeof path !== "string") {
    throw new InvalidStoragePathError("not_a_string");
  }
  const trimmed = path.trim();
  if (!trimmed) {
    throw new InvalidStoragePathError("empty");
  }
  if (trimmed.length > 1024) {
    throw new InvalidStoragePathError("too_long");
  }
  // No NUL or other ASCII control characters.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new InvalidStoragePathError("control_char");
  }
  // No backslashes, no scheme/host fragments.
  if (trimmed.includes("\\")) {
    throw new InvalidStoragePathError("backslash");
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw new InvalidStoragePathError("scheme");
  }
  // No absolute paths.
  if (trimmed.startsWith("/")) {
    throw new InvalidStoragePathError("absolute");
  }
  // No traversal segments anywhere in the path.
  const segments = trimmed.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new InvalidStoragePathError("traversal_or_empty_segment");
    }
  }
  return trimmed;
}

/**
 * Resolve a safe, user-friendly toast message for upload / signed-URL
 * failures. Returns the localised "invalid file name" copy when the
 * underlying error is an `InvalidStoragePathError`, otherwise falls
 * back to the caller-supplied generic message. The translator is
 * passed in so this module stays free of i18n imports.
 */
export function getFriendlyStoragePathErrorMessage(
  err: unknown,
  t: (key: string) => string,
  fallbackMessage: string,
): string {
  if (isInvalidStoragePathError(err)) {
    return t("common.invalidFileName");
  }
  return fallbackMessage;
}
