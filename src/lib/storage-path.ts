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
 * on rejection. Every rejection is also reported through a structured
 * logger (`logRejectedStoragePath`) so we can confirm in production logs
 * that the Aikido path-traversal finding stays at zero. The logger never
 * echoes the raw payload, only safe shape metadata (length, segment
 * count, leading char class, whether the input contained a scheme).
 */

/** Stable rejection reason tags. Safe to log and assert against in tests. */
export type StoragePathRejectionReason =
  | "not_a_string"
  | "empty"
  | "too_long"
  | "control_char"
  | "backslash"
  | "scheme"
  | "absolute"
  | "traversal_or_empty_segment";

/** Typed error thrown when a Storage object key fails sanitisation. */
export class InvalidStoragePathError extends Error {
  /** Stable discriminator so error shapes survive bundler renames. */
  readonly code = "INVALID_STORAGE_PATH" as const;
  /** Short reason tag, useful for logs. Never includes the offending value. */
  readonly reason: StoragePathRejectionReason;
  constructor(reason: StoragePathRejectionReason) {
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

/**
 * Structured event emitted whenever a path is rejected. Intentionally
 * carries only shape metadata, never the raw payload, so it is safe to
 * forward to console / Sentry / a SIEM without leaking attacker input
 * or PII embedded in filenames.
 */
export interface RejectedStoragePathEvent {
  /** Stable reason tag matching `InvalidStoragePathError.reason`. */
  reason: StoragePathRejectionReason;
  /** `typeof input` at rejection time. */
  inputType: string;
  /** Length of the raw input in code units, capped at 4096 for safety. */
  inputLength: number;
  /** Number of `/`-separated segments after trimming, when applicable. */
  segmentCount: number | null;
  /** Coarse classification of the first character. Never the char itself. */
  leadingCharClass: "alnum" | "slash" | "dot" | "control" | "other" | "none";
  /** Whether the input looked like it carried a URL scheme (foo://...). */
  hasSchemeShape: boolean;
  /** Whether the input contained any backslash. */
  hasBackslash: boolean;
  /** Whether the input contained any ASCII control / NUL byte. */
  hasControlChar: boolean;
  /** Optional caller-provided tag for log triage (e.g. "logo-upload"). */
  callsite?: string;
  /**
   * Tenant the rejection happened in, when known. Tenant IDs are
   * UUIDs and not sensitive on their own, so they are safe to log
   * and they make per-tenant abuse spikes detectable. Never include
   * user IDs, emails, file names, or other PII here.
   */
  tenantId?: string;
  /** ISO timestamp of the rejection. */
  rejectedAt: string;
}

export type RejectedStoragePathLogger = (event: RejectedStoragePathEvent) => void;

const defaultLogger: RejectedStoragePathLogger = (event) => {
  // Single structured line, prefixed so it is grep-able and so log
  // pipelines can route it. No raw input is ever included.
  // eslint-disable-next-line no-console
  console.warn("[security] storage-path rejected", event);
};

let activeLogger: RejectedStoragePathLogger = defaultLogger;

/**
 * Override the rejection logger (e.g. forward to Sentry, a backend
 * collector, or buffer in tests). Pass `null` to restore the default
 * console.warn sink.
 */
export function setRejectedStoragePathLogger(
  logger: RejectedStoragePathLogger | null,
): void {
  activeLogger = logger ?? defaultLogger;
}

function classifyLeadingChar(ch: string | undefined): RejectedStoragePathEvent["leadingCharClass"] {
  if (!ch) return "none";
  if (ch === "/") return "slash";
  if (ch === ".") return "dot";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(ch)) return "control";
  if (/[a-z0-9]/i.test(ch)) return "alnum";
  return "other";
}

/**
 * Tenant IDs in this app are v4 UUIDs. We refuse to log anything that
 * doesn't match that shape, defence-in-depth against a future caller
 * accidentally passing an email or filename through `tenantId`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeTenantId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function buildEvent(
  reason: StoragePathRejectionReason,
  rawInput: unknown,
  callsite: string | undefined,
  tenantId: string | undefined,
): RejectedStoragePathEvent {
  const isString = typeof rawInput === "string";
  const asString = isString ? (rawInput as string) : "";
  const cappedLength = Math.min(asString.length, 4096);
  const segmentCount = isString && asString.length > 0
    ? asString.trim().split("/").length
    : null;
  return {
    reason,
    inputType: typeof rawInput,
    inputLength: isString ? cappedLength : 0,
    segmentCount,
    leadingCharClass: classifyLeadingChar(isString ? asString.trim()[0] : undefined),
    hasSchemeShape: isString && /^[a-z][a-z0-9+.-]*:\/\//i.test(asString.trim()),
    hasBackslash: isString && asString.includes("\\"),
    // eslint-disable-next-line no-control-regex
    hasControlChar: isString && /[\u0000-\u001f\u007f]/.test(asString),
    callsite,
    tenantId: safeTenantId(tenantId),
    rejectedAt: new Date().toISOString(),
  };
}

/**
 * Emit a structured rejection event. Exposed so wrappers (e.g. signed
 * URL helpers) can attach `callsite` / `tenantId` while still routing
 * through the same sink. The raw payload is never forwarded.
 */
export function logRejectedStoragePath(
  reason: StoragePathRejectionReason,
  rawInput: unknown,
  context: { callsite?: string; tenantId?: string } = {},
): void {
  try {
    activeLogger(buildEvent(reason, rawInput, context.callsite, context.tenantId));
  } catch {
    // Logging must never break the calling code path.
  }
}

function reject(
  reason: StoragePathRejectionReason,
  rawInput: unknown,
  callsite: string | undefined,
  tenantId: string | undefined,
): never {
  logRejectedStoragePath(reason, rawInput, { callsite, tenantId });
  throw new InvalidStoragePathError(reason);
}

export interface AssertSafeStorageObjectPathOptions {
  /**
   * Optional short tag identifying where the assertion ran (e.g.
   * `"logo-upload"`, `"tenant-private:mintSignedUrl"`). Surfaces in
   * structured logs to make Aikido regression triage easier.
   */
  callsite?: string;
  /**
   * Tenant context for the rejection, when the caller knows it.
   * Must be a v4 UUID, anything else is dropped before logging so we
   * never accidentally emit emails / filenames / opaque tokens.
   */
  tenantId?: string;
}

export function assertSafeStorageObjectPath(
  path: string,
  options: AssertSafeStorageObjectPathOptions = {},
): string {
  const { callsite, tenantId } = options;
  if (typeof path !== "string") {
    reject("not_a_string", path, callsite, tenantId);
  }
  const trimmed = path.trim();
  if (!trimmed) {
    reject("empty", path, callsite, tenantId);
  }
  if (trimmed.length > 1024) {
    reject("too_long", path, callsite, tenantId);
  }
  // No NUL or other ASCII control characters.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    reject("control_char", path, callsite, tenantId);
  }
  // No backslashes, no scheme/host fragments.
  if (trimmed.includes("\\")) {
    reject("backslash", path, callsite, tenantId);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    reject("scheme", path, callsite, tenantId);
  }
  // No absolute paths.
  if (trimmed.startsWith("/")) {
    reject("absolute", path, callsite, tenantId);
  }
  // No traversal segments anywhere in the path.
  const segments = trimmed.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      reject("traversal_or_empty_segment", path, callsite, tenantId);
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
