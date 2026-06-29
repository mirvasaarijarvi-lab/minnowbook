// Shared assertion helpers for the per-function "shared headers on
// every Response" regression suites.
//
// The static scanner `src/test/security/edge-function-hsts-referrer-csp`
// already greps each function's source for the literal triad, but
// that's a syntactic check. These helpers give the integration tests
// (which actually invoke each handler with mocked Request objects) a
// single source of truth for the runtime assertions, so the suites
// stay byte-identical and a future header-name change has exactly one
// place to update.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SECURITY_HEADERS } from "./http-headers.ts";

/** The transport-security triad enforced on every edge function,
 *  including those (like `auth-email-hook`) that ship a narrower
 *  custom CORS bag rather than importing the full
 *  SECURITY_HEADERS object. */
export const SECURITY_TRIAD = {
  "Strict-Transport-Security": SECURITY_HEADERS["Strict-Transport-Security"],
  "Referrer-Policy": SECURITY_HEADERS["Referrer-Policy"],
  "Content-Security-Policy": SECURITY_HEADERS["Content-Security-Policy"],
} as const;

/** Assert the universal triad (HSTS + Referrer-Policy + CSP). Use
 *  this for every function. The triad is the floor: nothing weaker
 *  ever ships. */
export function assertSecurityTriad(res: Response, label: string) {
  for (const [name, expected] of Object.entries(SECURITY_TRIAD)) {
    const actual = res.headers.get(name);
    assertEquals(
      actual,
      expected,
      `[${label}] response missing or mismatched "${name}". ` +
        `expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    );
  }
}

/** Targeted CSP + HSTS exact-match assertion.
 *
 *  Browsers tolerate a surprising amount of CSP/HSTS weakening
 *  silently (e.g. dropping `frame-ancestors 'none'`, shortening
 *  `max-age`, removing `includeSubDomains`), and a generic
 *  "header is present" check would let any of those slip through.
 *  This helper compares each value byte-for-byte against the canonical
 *  SECURITY_HEADERS values and produces a scenario-tagged failure
 *  message so a regression points at the exact error path that
 *  shipped the weaker bag.
 *
 *  Use INSIDE each error-scenario test (one call per status code) in
 *  addition to `assertSecurityTriad` / `assertSharedHeaders`, so that
 *  the diff in CI output names the offending status. */
export function assertCspAndHsts(res: Response, scenario: string) {
  const csp = res.headers.get("Content-Security-Policy");
  const hsts = res.headers.get("Strict-Transport-Security");
  assertEquals(
    csp,
    SECURITY_HEADERS["Content-Security-Policy"],
    `[${scenario}] Content-Security-Policy must match SECURITY_HEADERS exactly. ` +
      `expected=${JSON.stringify(SECURITY_HEADERS["Content-Security-Policy"])} ` +
      `actual=${JSON.stringify(csp)}`,
  );
  assertEquals(
    hsts,
    SECURITY_HEADERS["Strict-Transport-Security"],
    `[${scenario}] Strict-Transport-Security must match SECURITY_HEADERS exactly. ` +
      `expected=${JSON.stringify(SECURITY_HEADERS["Strict-Transport-Security"])} ` +
      `actual=${JSON.stringify(hsts)}`,
  );
}

/** Assert the FULL SECURITY_HEADERS bag (triad + X-Content-Type-Options,
 *  X-Frame-Options, X-XSS-Protection, Cache-Control, Pragma, Vary).
 *  Use this for functions that import `corsHeaders` / `getCorsHeaders`
 *  from `_shared/http-headers.ts`. */
export function assertSharedHeaders(res: Response, label: string) {
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    const actual = res.headers.get(name);
    assertEquals(
      actual,
      expected,
      `[${label}] response missing or mismatched "${name}". ` +
        `expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    );
  }
}

/** Drain a Response body to keep Deno's resource sanitizer quiet
 *  when an assertion has already verified what it needs. */
export async function drainBody(res: Response) {
  if (res.body && !res.bodyUsed) {
    try {
      await res.body.cancel();
    } catch {
      /* ignore */
    }
  }
}

/** Set required Supabase env vars to harmless stub values for the
 *  duration of `fn`, restoring (or unsetting) afterwards. Many
 *  handlers read `Deno.env.get(...)!` at request time and would
 *  otherwise crash before reaching the response-building branch we
 *  want to inspect. */
export function withStubSupabaseEnv<T>(fn: () => Promise<T>): () => Promise<T> {
  const KEYS = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "LOVABLE_API_KEY",
  ] as const;
  return async () => {
    const prev: Record<string, string | undefined> = {};
    for (const k of KEYS) prev[k] = Deno.env.get(k);
    // Use truthiness (not ??) so that an inherited *empty-string* env var
    // (common in CI when a real secret isn't available and the workflow sets
    // the var to "" to mask it) is still replaced by a usable stub value.
    // Without this, `createClient(url, "")` throws "supabaseKey is required."
    // before the handler can reach its auth check, turning the expected 401
    // into a 500 and breaking the short-circuit / 401-contract suites.
    Deno.env.set("SUPABASE_URL", prev.SUPABASE_URL || "https://stub.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prev.SUPABASE_SERVICE_ROLE_KEY || "stub-service-key");
    Deno.env.set("SUPABASE_ANON_KEY", prev.SUPABASE_ANON_KEY || "stub-anon-key");
    Deno.env.set("LOVABLE_API_KEY", prev.LOVABLE_API_KEY || "stub-lovable-key");
    try {
      return await fn();
    } finally {
      for (const k of KEYS) {
        if (typeof prev[k] === "string") Deno.env.set(k, prev[k]!);
        else Deno.env.delete(k);
      }
    }
  };
}
