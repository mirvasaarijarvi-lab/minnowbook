// Standardized JSON error payload for edge functions.
//
// Goal: every auth-enforced (and ideally every) edge function returns the
// same shape, so clients can branch on `body.code`, surface `body.message`
// to users, and correlate failures with `body.requestId` in logs.
//
// Canonical shape:
//   {
//     "error":     "<CODE>",        // legacy alias of code — most callers
//                                   // already read body.error, keep it stable
//     "code":      "<CODE>",        // stable machine-readable token, SCREAMING_SNAKE
//     "message":   "<human text>",  // safe to render to end users
//     "status":    <number>,        // mirrors the HTTP status
//     "requestId": "<opt id>",      // optional, for log correlation
//     "details":   { ... }          // optional, structured extra context
//   }
//
// Why both `error` and `code`?
//   Many existing handlers and tests read `body.error` as the discriminator.
//   Keeping `error === code` preserves that contract while giving new callers
//   a clearer name. Do NOT remove `error` without a coordinated client update.

export const ErrorCodes = {
  // 400
  BAD_REQUEST: "BAD_REQUEST",
  INVALID_INPUT: "INVALID_INPUT",
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  // 401
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  INVALID_TOKEN: "INVALID_TOKEN",
  // 403
  FORBIDDEN: "FORBIDDEN",
  // 404
  NOT_FOUND: "NOT_FOUND",
  // 405
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  // 409
  CONFLICT: "CONFLICT",
  // 415
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  // 429
  RATE_LIMITED: "RATE_LIMITED",
  // 500/502/503/504
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes] | string;

export type ErrorPayload = {
  error: string;
  code: string;
  message: string;
  status: number;
  requestId?: string;
  details?: Record<string, unknown>;
};

export type ErrorResponseInit = {
  status: number;
  code: ErrorCode;
  message: string;
  corsHeaders?: Record<string, string>;
  requestId?: string;
  details?: Record<string, unknown>;
  /** Extra response headers (e.g. Retry-After for 429). */
  headers?: Record<string, string>;
};

/** Statuses that mean "this request was refused" — the leak-prone ones. */
export const DENIAL_STATUSES = [401, 403, 404, 410] as const;

export const REDACTED = "[redacted]";

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,}$/;
const SENSITIVE_KEY_RE = /tenant|email|token|guest|user|owner|customer|phone|name|secret|key/i;

/**
 * Strip anything that could identify another tenant (or its people) from the
 * structured context attached to a refusal. Used for both the JSON body of a
 * denial response and for denial log lines, so a refusal can never publish a
 * tenant id, an email, a booking token or a guest name.
 *
 * Fails closed: unknown nested shapes are dropped rather than passed through.
 */
export function redactDenialContext(
  details: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (typeof value === "string") {
      out[key] =
        UUID_RE.test(value) || EMAIL_RE.test(value) || TOKEN_RE.test(value) ? REDACTED : value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
      continue;
    }
    // Objects, arrays, functions: no safe way to vouch for the contents.
    out[key] = REDACTED;
  }
  return out;
}

/**
 * Build a Response with the canonical error payload. Always JSON; always
 * sets Content-Type; merges corsHeaders + any extra headers (e.g. Retry-After).
 *
 * On denial statuses the structured `details` are redacted first.
 */
export function errorResponse(init: ErrorResponseInit): Response {
  const code = String(init.code);
  const payload: ErrorPayload = {
    error: code,
    code,
    message: init.message,
    status: init.status,
  };
  if (init.requestId) payload.requestId = init.requestId;
  const isDenial = (DENIAL_STATUSES as readonly number[]).includes(init.status);
  const details = isDenial ? redactDenialContext(init.details) : init.details;
  if (details && Object.keys(details).length > 0) {
    payload.details = details;
  }
  return new Response(JSON.stringify(payload), {
    status: init.status,
    headers: {
      ...(init.corsHeaders ?? {}),
      ...(init.headers ?? {}),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/**
 * One-line, leak-free log entry for a refused request. Only the request id,
 * the action and the refusal code survive verbatim; everything else goes
 * through `redactDenialContext`.
 */
export function denialLogLine(input: {
  fn: string;
  action?: string;
  code: ErrorCode;
  status: number;
  requestId?: string;
  context?: Record<string, unknown>;
}): string {
  const parts = [
    `[${input.fn}] denied`,
    `code=${String(input.code)}`,
    `status=${input.status}`,
  ];
  if (input.action) parts.push(`action=${input.action}`);
  if (input.requestId) parts.push(`request_id=${input.requestId}`);
  const ctx = redactDenialContext(input.context);
  if (ctx && Object.keys(ctx).length > 0) parts.push(`context=${JSON.stringify(ctx)}`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Convenience helpers — each maps to one HTTP status with a sane default code
// and message, but every field can be overridden by the caller.
// ---------------------------------------------------------------------------

type Overrides = Partial<Omit<ErrorResponseInit, "status">>;

export function badRequest(corsHeaders: Record<string, string>, overrides: Overrides = {}): Response {
  return errorResponse({
    status: 400,
    code: ErrorCodes.BAD_REQUEST,
    message: "Bad request",
    corsHeaders,
    ...overrides,
  });
}

export function unauthorized(corsHeaders: Record<string, string>, overrides: Overrides = {}): Response {
  return errorResponse({
    status: 401,
    code: ErrorCodes.NOT_AUTHENTICATED,
    message: "Not authenticated",
    corsHeaders,
    ...overrides,
  });
}

export function forbidden(corsHeaders: Record<string, string>, overrides: Overrides = {}): Response {
  return errorResponse({
    status: 403,
    code: ErrorCodes.FORBIDDEN,
    message: "Forbidden",
    corsHeaders,
    ...overrides,
  });
}

export function notFound(corsHeaders: Record<string, string>, overrides: Overrides = {}): Response {
  return errorResponse({
    status: 404,
    code: ErrorCodes.NOT_FOUND,
    message: "Not found",
    corsHeaders,
    ...overrides,
  });
}

export function methodNotAllowed(
  corsHeaders: Record<string, string>,
  allow: string[],
  overrides: Overrides = {},
): Response {
  return errorResponse({
    status: 405,
    code: ErrorCodes.METHOD_NOT_ALLOWED,
    message: "Method not allowed",
    corsHeaders,
    headers: { Allow: allow.join(", "), ...(overrides.headers ?? {}) },
    ...overrides,
  });
}

export function tooManyRequests(
  corsHeaders: Record<string, string>,
  retryAfterSeconds?: number,
  overrides: Overrides = {},
): Response {
  const headers: Record<string, string> = { ...(overrides.headers ?? {}) };
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    headers["Retry-After"] = String(Math.ceil(retryAfterSeconds));
  }
  return errorResponse({
    status: 429,
    code: ErrorCodes.RATE_LIMITED,
    message: "Too many requests. Please try again later.",
    corsHeaders,
    ...overrides,
    headers,
  });
}

export function requestTooLarge(corsHeaders: Record<string, string>, overrides: Overrides = {}): Response {
  return errorResponse({
    status: 413,
    code: ErrorCodes.REQUEST_TOO_LARGE,
    message: "Request too large",
    corsHeaders,
    ...overrides,
  });
}

export function internalError(corsHeaders: Record<string, string>, overrides: Overrides = {}): Response {
  return errorResponse({
    status: 500,
    code: ErrorCodes.INTERNAL_ERROR,
    // Generic by default — never leak exception messages to clients.
    message: "An internal error occurred. Please try again.",
    corsHeaders,
    ...overrides,
  });
}

export function serviceUnavailable(corsHeaders: Record<string, string>, overrides: Overrides = {}): Response {
  return errorResponse({
    status: 503,
    code: ErrorCodes.SERVICE_UNAVAILABLE,
    message: "Service temporarily unavailable.",
    corsHeaders,
    ...overrides,
  });
}
