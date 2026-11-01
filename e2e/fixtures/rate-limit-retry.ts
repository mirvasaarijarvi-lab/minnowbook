import type { APIResponse } from "@playwright/test";

export function rateLimitDelayMs(value: string | undefined, now = Date.now()): number {
  const seconds = Number(value);
  const delay = value?.trim() && Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value ?? "") - now;
  return Math.max(1000, Number.isFinite(delay) ? delay : 60_000);
}

/** Retry only explicit refusals, never successful writes or validation errors. */
export async function withRateLimitRetry(
  send: () => Promise<APIResponse>,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<APIResponse> {
  const response = await send();
  if (response.status() !== 429) return response;
  const delay = rateLimitDelayMs(response.headers()["retry-after"]);
  await response.dispose();
  await wait(delay);
  // Return the final response unchanged so callers still fail on exhaustion.
  return send();
}