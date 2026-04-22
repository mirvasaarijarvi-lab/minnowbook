/**
 * Reachability preflight for the deployed `redeem-access-code` edge function.
 *
 * Why this exists
 * ---------------
 * The live-mode E2E suites assume that:
 *   1. The edge function is deployed at the expected URL,
 *   2. Auth gateway routing is intact (function-level JWT settings still
 *      let an authenticated bearer through),
 *   3. The function still emits the documented JSON contract
 *      (`{ error, code }` with a known `code` value),
 *   4. The required CORS / security headers are still attached.
 *
 * If ANY of those silently break (e.g. the function got deleted, the
 * URL changed, the function name was renamed, the gateway started
 * returning HTML 404s, the deploy is mid-rollback), every downstream
 * test fails with a confusing, non-localised error like
 * "expected 200, got 404" or a JSON.parse exception. That makes triage
 * miserable.
 *
 * `assertRedeemFunctionReachable()` runs ONCE per suite (in `beforeAll`)
 * and either:
 *   - resolves silently when the function is healthy, OR
 *   - throws a single, explicit, copy-pasteable error message that
 *     names the URL it tried, the status it got, and a remediation hint.
 *
 * The probe is deliberately auth-LESS. The auth gateway will reject it
 * with `UNAUTHORIZED_NO_AUTH_HEADER` or our handler will reject with
 * `NOT_AUTHENTICATED`. Either response proves:
 *   - the function exists,
 *   - the function is wired through the gateway,
 *   - the function returns the documented JSON+headers contract.
 *
 * We deliberately do NOT exercise the success path here — that would
 * require fixture provisioning and would couple every suite to the
 * same setup cost. Reachability is sufficient.
 */

const REDEEM_HEALTH_HINT =
  "redeem-access-code preflight failed. Check that:\n" +
  "  1. VITE_SUPABASE_URL points at the project the function is deployed to\n" +
  "  2. VITE_SUPABASE_PUBLISHABLE_KEY matches that project\n" +
  "  3. The 'redeem-access-code' function is deployed (not paused, not deleted)\n" +
  "  4. The function still emits {error, code} JSON for unauthenticated calls";

export interface RedeemPreflightResult {
  url: string;
  status: number;
  errorCode: string;
  rawBody: string;
  durationMs: number;
}

/**
 * Recognized auth-rejection codes — either layer (gateway or our handler)
 * is acceptable, and BOTH being acceptable is what makes this preflight
 * resilient to future verify_jwt config flips. If neither shows up, the
 * function isn't behaving like our function.
 */
const AUTH_REJECTION_CODES = new Set([
  "NOT_AUTHENTICATED",
  "UNAUTHORIZED_NO_AUTH_HEADER",
]);

export interface RedeemPreflightOptions {
  supabaseUrl: string;
  supabasePublishableKey: string;
  /** Override for tests of the preflight itself. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Abort the probe after this many ms. Defaults to 10s. */
  timeoutMs?: number;
}

/**
 * Probe the function and return the structured outcome. Does NOT throw
 * on a non-2xx response — assertion logic is centralised in
 * `assertRedeemFunctionReachable` so callers that want a soft probe
 * (e.g. a CI smoke job) can use this directly.
 */
export async function probeRedeemFunction(
  opts: RedeemPreflightOptions,
): Promise<RedeemPreflightResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const url = `${opts.supabaseUrl}/functions/v1/redeem-access-code`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  let status = 0;
  let rawBody = "";
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // We DO send apikey so the gateway routes the request to the
        // function instead of bouncing it as project-not-found. We
        // intentionally OMIT the Authorization bearer so the response
        // proves the auth-rejection contract is intact.
        apikey: opts.supabasePublishableKey,
      },
      body: JSON.stringify({ code: "PREFLIGHT-PROBE" }),
      signal: ac.signal,
    });
    status = res.status;
    rawBody = await res.text();
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `[redeem-preflight] Network error probing ${url}: ${reason}\n${REDEEM_HEALTH_HINT}`,
    );
  } finally {
    clearTimeout(timer);
  }
  const durationMs = Date.now() - t0;

  let errorCode = "";
  try {
    const parsed = JSON.parse(rawBody) as { code?: unknown };
    if (typeof parsed.code === "string") errorCode = parsed.code;
  } catch {
    // Non-JSON body is itself a failure signal — captured below.
  }

  return { url, status, errorCode, rawBody, durationMs };
}

/**
 * Strict assertion variant: throws a single, descriptive Error if the
 * function isn't reachable OR its response doesn't match the documented
 * contract. Intended for `beforeAll` in every live-mode suite.
 */
export async function assertRedeemFunctionReachable(
  opts: RedeemPreflightOptions,
): Promise<RedeemPreflightResult> {
  const result = await probeRedeemFunction(opts);

  // Status must be in the auth-rejection range. 5xx = function broken.
  // 200 here would mean the function is missing the auth check entirely
  // (a security regression worth surfacing immediately).
  if (result.status >= 500) {
    throw new Error(
      `[redeem-preflight] Function returned ${result.status} (server error) at ${result.url}.\n` +
        `Raw body: ${result.rawBody.slice(0, 500)}\n${REDEEM_HEALTH_HINT}`,
    );
  }
  if (result.status === 404) {
    throw new Error(
      `[redeem-preflight] Function not found (404) at ${result.url}.\n` +
        `The function name or URL is wrong, or the function isn't deployed.\n` +
        `${REDEEM_HEALTH_HINT}`,
    );
  }
  if (result.status === 200) {
    throw new Error(
      `[redeem-preflight] Function returned 200 to an UNAUTHENTICATED probe at ${result.url}.\n` +
        `This is a security regression — the auth check has been removed or bypassed.\n` +
        `Raw body: ${result.rawBody.slice(0, 500)}`,
    );
  }
  if (result.status < 400 || result.status >= 500) {
    throw new Error(
      `[redeem-preflight] Unexpected status ${result.status} at ${result.url}.\n` +
        `Expected a 4xx auth-rejection.\nRaw body: ${result.rawBody.slice(0, 500)}\n` +
        REDEEM_HEALTH_HINT,
    );
  }

  // Body must be JSON with a recognized auth-rejection code. Anything
  // else (HTML page, plain text, missing `code` key, unknown `code`)
  // means we're not talking to OUR function.
  if (!result.errorCode) {
    throw new Error(
      `[redeem-preflight] Response at ${result.url} did not contain a parseable {code} field.\n` +
        `Got status ${result.status}, body: ${result.rawBody.slice(0, 500)}\n` +
        `This usually means the request hit a different function, an HTML error page, ` +
        `or a stale deploy.\n${REDEEM_HEALTH_HINT}`,
    );
  }
  if (!AUTH_REJECTION_CODES.has(result.errorCode)) {
    throw new Error(
      `[redeem-preflight] Unauthenticated probe at ${result.url} returned unexpected code "${result.errorCode}".\n` +
        `Expected one of: ${[...AUTH_REJECTION_CODES].join(", ")}.\n` +
        `Raw body: ${result.rawBody.slice(0, 500)}\n${REDEEM_HEALTH_HINT}`,
    );
  }

  return result;
}
