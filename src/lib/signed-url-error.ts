/**
 * Stable error contract for signed-URL operations.
 *
 * Every failure path that originates in our signed-URL helpers should
 * surface a `SignedUrlError` with a machine-readable `code` so callers
 * (UI toasts, retries, tests) can branch on the kind of failure without
 * regex-matching free-form messages.
 *
 * Codes:
 *   - "invalid_path"  rejected by assertSafeStorageObjectPath
 *   - "forbidden"     RLS denial / anon / non-member (HTTP 401, 403)
 *   - "not_found"     bucket or object missing (HTTP 404)
 *   - "transport"     fetch failed, timeout, DNS, abort, ECONN*
 *   - "unknown"       anything we couldn't classify
 */

export type SignedUrlErrorCode =
  | "invalid_path"
  | "forbidden"
  | "not_found"
  | "transport"
  | "unknown";

export interface SignedUrlErrorInit {
  httpStatus?: number;
  cause?: unknown;
}

export class SignedUrlError extends Error {
  readonly code: SignedUrlErrorCode;
  readonly httpStatus?: number;
  // Native `Error.cause` is supported in modern runtimes; we mirror it
  // here for older targets and for explicit typing.
  readonly cause?: unknown;

  constructor(code: SignedUrlErrorCode, message: string, init: SignedUrlErrorInit = {}) {
    super(message);
    this.name = "SignedUrlError";
    this.code = code;
    this.httpStatus = init.httpStatus;
    this.cause = init.cause;
  }
}

export function isSignedUrlError(err: unknown): err is SignedUrlError {
  return err instanceof SignedUrlError || (typeof err === "object" && err !== null && (err as any).name === "SignedUrlError");
}

interface ClassifyInput {
  /** SDK-shaped error from `supabase.storage.from(...).createSignedUrl(...)`. */
  sdkError?: { message?: string; status?: number; statusCode?: number | string } | null;
  /** Anything caught from a thrown failure (transport, invalid path, etc.). */
  thrown?: unknown;
  /** Optional context appended to the rendered message. */
  contextMessage?: string;
}

const FORBIDDEN_RE = /permission|denied|policy|not\s*allowed|unauthor|forbidden/i;
const NOT_FOUND_RE = /not\s*found|object.*missing|no such|does not exist/i;
const TRANSPORT_RE = /fetch failed|network|timeout|aborted?|ECONN|ENOTFOUND|EAI_AGAIN|socket hang up/i;

function pickStatus(sdkError: ClassifyInput["sdkError"]): number | undefined {
  if (!sdkError) return undefined;
  if (typeof sdkError.status === "number") return sdkError.status;
  const sc = sdkError.statusCode;
  if (typeof sc === "number") return sc;
  if (typeof sc === "string" && /^\d+$/.test(sc)) return Number(sc);
  return undefined;
}

/**
 * Classify a signed-URL failure into the stable contract. Always returns
 * a `SignedUrlError` so callers can `throw` it directly.
 */
export function classifySignedUrlFailure(input: ClassifyInput): SignedUrlError {
  const { sdkError, thrown, contextMessage } = input;

  // 1. Invalid-path always wins (it never even reached the network).
  if (thrown && typeof thrown === "object" && (thrown as any).name === "InvalidStoragePathError") {
    const msg = (thrown as Error).message || "Invalid storage path";
    return new SignedUrlError("invalid_path", contextMessage ? `${contextMessage}: ${msg}` : msg, { cause: thrown });
  }

  const status = pickStatus(sdkError);
  const sdkMsg = sdkError?.message ?? "";
  const thrownMsg = thrown instanceof Error ? thrown.message : thrown != null ? String(thrown) : "";
  const haystack = `${sdkMsg} ${thrownMsg}`.trim();
  const renderMsg = (fallback: string) => {
    const base = sdkMsg || thrownMsg || fallback;
    return contextMessage ? `${contextMessage}: ${base}` : base;
  };

  // 2. HTTP-status driven classification (most reliable signal).
  if (status === 401 || status === 403) {
    return new SignedUrlError("forbidden", renderMsg("Forbidden"), { httpStatus: status, cause: thrown ?? sdkError });
  }
  if (status === 404) {
    return new SignedUrlError("not_found", renderMsg("Not found"), { httpStatus: status, cause: thrown ?? sdkError });
  }

  // 3. Transport errors (these are usually `thrown`, not `sdkError`).
  if (
    (thrown instanceof TypeError) ||
    TRANSPORT_RE.test(haystack)
  ) {
    return new SignedUrlError("transport", renderMsg("Transport error"), { httpStatus: status, cause: thrown ?? sdkError });
  }

  // 4. Message-shape fallbacks.
  if (FORBIDDEN_RE.test(haystack)) {
    return new SignedUrlError("forbidden", renderMsg("Forbidden"), { httpStatus: status, cause: thrown ?? sdkError });
  }
  if (NOT_FOUND_RE.test(haystack)) {
    return new SignedUrlError("not_found", renderMsg("Not found"), { httpStatus: status, cause: thrown ?? sdkError });
  }

  return new SignedUrlError("unknown", renderMsg("Unknown signed-URL error"), { httpStatus: status, cause: thrown ?? sdkError });
}
