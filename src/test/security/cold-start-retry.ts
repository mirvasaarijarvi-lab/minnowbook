/**
 * Shared cold-start retry helper for live edge function probes.
 *
 * Wraps a fetch with a bounded retry on transient 5xx responses (502,
 * 503, 504) and per-attempt network timeouts, using a small exponential
 * backoff (500ms, then 1500ms) plus +/- 25% jitter. Logs each retry
 * with method, URL, status, and attempt count so CI gate failures show
 * exactly which probe tripped a cold-start retry. Real regressions
 * still fail because they reproduce on every attempt.
 *
 * The per-attempt timeout prevents a single hung TCP/TLS handshake (a
 * known cold-start failure mode in the Supabase functions gateway)
 * from consuming the entire test budget and surfacing as an opaque
 * "Test timed out in 30000ms" without ever reaching the assertion.
 */
const PER_ATTEMPT_TIMEOUT_MS = 8_000;

export async function fetchWithColdStartRetry(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const maxAttempts = 3; // 1 initial + 2 retries
  const baseDelayMs = 500;

  async function attempt(): Promise<{ res: Response | null; aborted: boolean }> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PER_ATTEMPT_TIMEOUT_MS);
    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal });
      return { res, aborted: false };
    } catch (err) {
      const aborted =
        (err instanceof Error && err.name === "AbortError") ||
        (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError");
      if (!aborted) throw err;
      return { res: null, aborted: true };
    } finally {
      clearTimeout(t);
    }
  }

  let last = await attempt();
  for (let i = 1; i < maxAttempts; i++) {
    const transient =
      last.aborted ||
      (last.res !== null && (last.res.status === 502 || last.res.status === 503 || last.res.status === 504));
    if (!transient) return last.res as Response;

    // Drain body so the connection can be reused.
    if (last.res) await last.res.text().catch(() => "");

    const expDelay = baseDelayMs * Math.pow(3, i - 1);
    const jitter = expDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.max(0, Math.round(expDelay + jitter));
    const statusLabel = last.aborted ? `timeout(${PER_ATTEMPT_TIMEOUT_MS}ms)` : String(last.res!.status);
    // eslint-disable-next-line no-console
    console.warn(
      `[cors-gate] transient ${statusLabel} on ${method} ${input} (attempt ${i}/${maxAttempts}), retrying after ${delay}ms backoff`,
    );
    await new Promise((r) => setTimeout(r, delay));
    last = await attempt();
    const resultLabel = last.aborted ? `timeout(${PER_ATTEMPT_TIMEOUT_MS}ms)` : `status=${last.res!.status}`;
    // eslint-disable-next-line no-console
    console.warn(
      `[cors-gate] retry result for ${method} ${input} (attempt ${i + 1}/${maxAttempts}): ${resultLabel}`,
    );
  }

  if (last.res) return last.res;
  // All attempts aborted: surface a synthetic 504 so callers see a Response
  // (assertions will fail clearly instead of hanging) without throwing.
  return new Response(
    JSON.stringify({ error: "cold-start retry exhausted (per-attempt timeout)" }),
    {
      status: 504,
      headers: { "content-type": "application/json", "x-cold-start-retry": "exhausted" },
    },
  );
}
