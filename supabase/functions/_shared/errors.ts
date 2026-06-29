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

/**
 * Build a Response with the canonical error payload. Always JSON; always
 * sets Content-Type; merges corsHeaders + any extra headers (e.g. Retry-After).
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
  if (init.details && Object.keys(init.details).length > 0) {
    payload.details = init.details;
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
