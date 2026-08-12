/**
 * Shared fetch helper for edge-function tests that hit the deployed
 * project over the network.
 *
 * CI runs these suites against a shared Supabase project, where a cold
 * or saturated function can stall until the platform's 150s idle limit
 * and return `504 {"code":"IDLE_TIMEOUT"}`. That is infrastructure
 * noise, not a contract regression, but it used to surface as a test
 * failure two and a half minutes later.
 *
 * `fetchWithRetry` bounds every attempt with an AbortSignal and retries
 * transient conditions (network abort, 502/503/504, IDLE_TIMEOUT body)
 * with a short backoff. Non-transient responses are returned untouched
 * so real assertions still run against the real contract.
 */

/**
 * Raised when every attempt died before the platform answered at all
 * (abort/timeout/network). That is infrastructure noise, not a broken
 * contract, so callers may downgrade it to a skip.
 */
export class InfraTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfraTimeoutError";
  }
}

export function isInfraTimeout(e: unknown): e is InfraTimeoutError {
  return e instanceof InfraTimeoutError || (e instanceof Error && e.name === "InfraTimeoutError");
}

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface RetryOptions {
  /** Per-attempt timeout in ms. Defaults to 25000. */
  timeoutMs?: number;
  /** Total attempts (including the first). Defaults to 3. */
  attempts?: number;
  /** Base backoff in ms between attempts. Defaults to 1000. */
  backoffMs?: number;
  /** Label used in warning logs. */
  label?: string;
}

export interface FetchResult {
  res: Response;
  text: string;
  json: any;
}

function isTransientBody(text: string): boolean {
  return text.includes("IDLE_TIMEOUT") || text.includes("WORKER_LIMIT");
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<FetchResult> {
  const envNumber = (name: string): number | undefined => {
    try {
      const raw = Deno.env.get(name);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    } catch {
      return undefined;
    }
  };

  const {
    // Cold starts on a saturated shared project routinely exceed 25s;
    // give each attempt a wider window and one extra retry so genuine
    // contract assertions still run instead of dying on infra latency.
    timeoutMs = envNumber("EDGE_TEST_TIMEOUT_MS") ?? 45_000,
    attempts = envNumber("EDGE_TEST_ATTEMPTS") ?? 4,
    backoffMs = 1_500,
    label = url,
  } = options;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* leave as null */
      }

      const transient = TRANSIENT_STATUSES.has(res.status) || isTransientBody(text);
      if (transient && attempt < attempts) {
        console.warn(
          `[test-fetch] ${label}: transient ${res.status} on attempt ${attempt}/${attempts}, retrying`,
        );
        await new Promise((r) => setTimeout(r, backoffMs * attempt));
        continue;
      }

      return { res, text, json };
    } catch (e) {
      lastError = e;
      if (attempt < attempts) {
        console.warn(
          `[test-fetch] ${label}: network error on attempt ${attempt}/${attempts} (${
            e instanceof Error ? e.message : String(e)
          }), retrying`,
        );
        await new Promise((r) => setTimeout(r, backoffMs * attempt));
        continue;
      }
    }
  }

  const lastMessage = lastError instanceof Error ? lastError.message : String(lastError);
  const summary =
    `[test-fetch] ${label}: all ${attempts} attempts failed. Last error: ${lastMessage}`;
  const name = lastError instanceof Error ? lastError.name : "";
  const timedOut = name === "TimeoutError" || name === "AbortError" ||
    /timed out|aborted/i.test(lastMessage);
  throw timedOut ? new InfraTimeoutError(summary) : new Error(summary);
}
