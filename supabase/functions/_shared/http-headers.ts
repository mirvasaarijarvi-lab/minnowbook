/**
 * Shared CORS + transport-security headers for every edge function.
 *
 * Single source of truth so a downgrade attack on one function (or a
 * copy-paste regression of one header object) can never silently
 * weaken the rest. Every header value defined here is asserted by
 * `src/test/security/edge-function-hsts-referrer-csp.test.ts`, which
 * follows imports from each function's `index.ts` into this file.
 *
 * Two entry points:
 *
 *   - `corsHeaders` — a static bag suitable for functions that don't
 *     need origin allowlisting (cron entrypoints, public webhooks,
 *     ical feeds, etc). Sets `Access-Control-Allow-Origin: *`.
 *
 *   - `getCorsHeaders(req, opts?)` — request-aware helper that echoes
 *     the request Origin only when it matches the allowlist. Use
 *     this for any function reachable from a logged-in browser.
 *
 * Both share the SAME security triad (HSTS / Referrer-Policy / CSP)
 * plus X-Content-Type-Options + X-Frame-Options, so the static
 * scanner finds the literal strings in this single file.
 */

/**
 * Canonical security headers shared by every response. Spread into
 * any header bag the function returns so success and error paths
 * stay symmetric.
 *
 * NOTE: The literal strings below are scanned by the
 * `edge-function-hsts-referrer-csp` regression suite. Keep them as
 * direct string literals (not template strings or concatenations)
 * so the regex extractor can read them.
 */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "Vary": "Origin",
} as const;

/** Default Access-Control-Allow-Headers. Covers the Supabase JS client
 *  fingerprinting headers plus the usual auth/content-type pair. */
export const DEFAULT_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/**
 * Production allowlist for browser-facing functions. Includes the
 * canonical hosts plus subdomain patterns for Lovable preview / project
 * URLs. Sub-resources like userinfo (`@`), ports (`:`), or paths (`/`)
 * are rejected by the regex character class.
 */
export const DEFAULT_ALLOWED_ORIGINS: ReadonlyArray<string | RegExp> = [
  "https://minnowbook.lovable.app",
  "https://mimmobook.com",
  "https://www.mimmobook.com",
  /^https:\/\/[a-zA-Z0-9.-]+\.lovable\.app$/,
  /^https:\/\/[a-zA-Z0-9.-]+\.lovableproject\.com$/,
  /^https:\/\/[a-zA-Z0-9.-]+\.mimmobook\.com$/,
];

export interface CorsOptions {
  /** Override the allowlist. Pass the literal string `"*"` to send
   *  `Access-Control-Allow-Origin: *` (browser-public endpoints). */
  allowOrigins?: "*" | ReadonlyArray<string | RegExp>;
  /** Additional/replacement Access-Control-Allow-Headers value. */
  allowHeaders?: string;
  /** Additional Access-Control-Allow-Headers appended to the default. */
  extraAllowHeaders?: string;
  /** Optional Access-Control-Allow-Methods value. */
  allowMethods?: string;
  /** Optional Access-Control-Allow-Credentials. Defaults to omitted. */
  allowCredentials?: boolean;
  /** Extra response headers to merge in (e.g. function-specific
   *  Cache-Control overrides). Take precedence over defaults. */
  extraHeaders?: Record<string, string>;
}

export function isOriginAllowed(
  origin: string,
  allowlist: ReadonlyArray<string | RegExp> = DEFAULT_ALLOWED_ORIGINS,
): boolean {
  if (!origin) return false;
  return allowlist.some((entry) =>
    typeof entry === "string" ? entry === origin : entry.test(origin)
  );
}

/**
 * Build the canonical response header bag for a given request.
 *
 * The returned object includes:
 *   - Access-Control-Allow-Origin (echoed when allowed, else omitted)
 *   - Access-Control-Allow-Headers
 *   - The full SECURITY_HEADERS triad
 *   - Any caller-supplied extras
 *
 * For wildcard endpoints pass `{ allowOrigins: "*" }`.
 */
export function getCorsHeaders(
  req: Request,
  opts: CorsOptions = {},
): Record<string, string> {
  const allowHeaders = opts.allowHeaders
    ?? (opts.extraAllowHeaders
      ? `${DEFAULT_ALLOW_HEADERS}, ${opts.extraAllowHeaders}`
      : DEFAULT_ALLOW_HEADERS);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowHeaders,
    ...SECURITY_HEADERS,
  };

  if (opts.allowMethods) headers["Access-Control-Allow-Methods"] = opts.allowMethods;
  if (opts.allowCredentials) headers["Access-Control-Allow-Credentials"] = "true";

  if (opts.allowOrigins === "*") {
    headers["Access-Control-Allow-Origin"] = "*";
  } else {
    const origin = req.headers.get("Origin") ?? "";
    if (isOriginAllowed(origin, opts.allowOrigins ?? DEFAULT_ALLOWED_ORIGINS)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
    // When disallowed, omit the header entirely so the browser
    // blocks the response rather than trusting a fallback value.
  }

  if (opts.extraHeaders) Object.assign(headers, opts.extraHeaders);

  return headers;
}

/**
 * Static, request-less header bag for functions that don't need
 * origin allowlisting (cron jobs, public webhooks, ical feeds, etc).
 * Equivalent to `getCorsHeaders(req, { allowOrigins: "*" })` but
 * available at module top-level scope.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
  ...SECURITY_HEADERS,
};
