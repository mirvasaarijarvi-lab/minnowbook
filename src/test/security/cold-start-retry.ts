/**
 * Shared cold-start retry helper for live edge function probes.
 *
 * Wraps a fetch with a bounded retry on transient 5xx responses (502,
 * 503, 504) using a small exponential backoff (500ms, then 1500ms)
 * plus +/- 25% jitter. Logs each retry with method, URL, status, and
 * attempt count so CI gate failures show exactly which probe tripped
 * a cold-start retry. Real regressions still fail because they
 * reproduce on every attempt.
 */
export async function fetchWithColdStartRetry(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const maxAttempts = 3; // 1 initial + 2 retries
  const baseDelayMs = 500;
  let res = await fetch(input, init);
  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    if (res.status !== 502 && res.status !== 503 && res.status !== 504) {
      return res;
    }
    // Drain the body so the connection can be reused.
    await res.text().catch(() => "");
    const expDelay = baseDelayMs * Math.pow(3, attempt - 1);
    const jitter = expDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.max(0, Math.round(expDelay + jitter));
    // eslint-disable-next-line no-console
    console.warn(
      `[cors-gate] transient ${res.status} on ${method} ${input} (attempt ${attempt}/${maxAttempts}), retrying after ${delay}ms backoff`,
    );
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch(input, init);
    // eslint-disable-next-line no-console
    console.warn(
      `[cors-gate] retry result for ${method} ${input} (attempt ${attempt + 1}/${maxAttempts}): status=${res.status}`,
    );
  }
  return res;
}
