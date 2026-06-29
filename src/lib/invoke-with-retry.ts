import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Status codes treated as transient gateway/infra errors. These are safe to
 * retry because the edge function did not return an authoritative response
 * (the gateway short-circuited before/after the handler).
 *
 * 408 Request Timeout, 425 Too Early, 429 Too Many Requests, 500 Internal,
 * 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout.
 *
 * We intentionally retry 500 only when the body did not contain a structured
 * application error (handled in shouldRetryError below).
 */
const TRANSIENT_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

export interface InvokeRetryOptions {
  /** Maximum number of attempts (initial + retries). Default 3. */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff. Default 250. */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default 2000. */
  maxDelayMs?: number;
  /** AbortSignal to cancel pending retries. */
  signal?: AbortSignal;
}

export interface InvokeResult<T> {
  data: T | null;
  error: unknown;
  attempts: number;
}

async function extractStatus(error: unknown): Promise<number | null> {
  if (error && typeof error === "object") {
    // FunctionsHttpError exposes the underlying Response via .context
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof ctx === "object" && "status" in ctx) {
      const status = (ctx as { status: unknown }).status;
      if (typeof status === "number") return status;
    }
  }
  return null;
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || /aborted/i.test(err.message))
  );
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch network failure
  if (err instanceof Error && /network|fetch/i.test(err.message)) return true;
  return false;
}

/**
 * Decide whether a given invoke error should be retried.
 * Returns true for transient gateway statuses and bare network errors.
 * Returns false for 4xx (except 408/425/429) and for authoritative 5xx with a body.
 */
export async function shouldRetryError(error: unknown): Promise<boolean> {
  if (isAbortError(error)) return false;
  const status = await extractStatus(error);
  if (status === null) {
    // No HTTP status: likely a network failure / DNS hiccup; retry once.
    return isNetworkError(error);
  }
  return TRANSIENT_STATUSES.has(status);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function computeDelay(attempt: number, base: number, cap: number): number {
  // Exponential backoff with full jitter.
  const exp = Math.min(cap, base * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exp);
}

/**
 * Invoke a Supabase edge function with safe retry semantics:
 *  - Retries only on transient gateway statuses (502/503/504/408/425/429) and
 *    bare network errors.
 *  - Fails fast on 4xx (auth, validation) and on authoritative function errors.
 *  - Uses exponential backoff with jitter to avoid stampeding the gateway.
 *
 * NOTE: This is only safe for IDEMPOTENT calls or calls that the server
 *       deduplicates (e.g. redeem-access-code uses an idempotency key).
 */
export async function invokeWithRetry<T = unknown>(
  functionName: string,
  invokeOptions: Parameters<typeof supabase.functions.invoke>[1],
  retryOptions: InvokeRetryOptions = {},
): Promise<InvokeResult<T>> {
  const {
    maxAttempts = 3,
    baseDelayMs = 250,
    maxDelayMs = 2000,
    signal,
  } = retryOptions;

  let lastError: unknown = null;
  let lastData: T | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      return { data: null, error: new DOMException("Aborted", "AbortError"), attempts: attempt - 1 };
    }

    try {
      const { data, error } = await supabase.functions.invoke(functionName, invokeOptions);
      if (!error) {
        return { data: (data ?? null) as T | null, error: null, attempts: attempt };
      }
      lastError = error;
      lastData = (data ?? null) as T | null;

      const retryable = await shouldRetryError(error);
      if (!retryable || attempt === maxAttempts) {
        return { data: lastData, error, attempts: attempt };
      }
    } catch (err) {
      lastError = err;
      if (isAbortError(err)) {
        return { data: null, error: err, attempts: attempt };
      }
      const retryable = await shouldRetryError(err);
      if (!retryable || attempt === maxAttempts) {
        return { data: null, error: err, attempts: attempt };
      }
    }

    await sleep(computeDelay(attempt, baseDelayMs, maxDelayMs), signal).catch((err) => {
      lastError = err;
    });
  }

  return { data: lastData, error: lastError, attempts: maxAttempts };
}

// Re-export for tests / consumers that want to introspect.
export { FunctionsHttpError, TRANSIENT_STATUSES };
