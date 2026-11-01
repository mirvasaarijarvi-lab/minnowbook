import { describe, expect, it, vi } from "vitest";
import type { APIResponse } from "@playwright/test";
import { rateLimitDelayMs, withRateLimitRetry } from "../../e2e/fixtures/rate-limit-retry";

function response(status: number, retryAfter = "60") {
  return {
    status: () => status,
    headers: () => ({ "retry-after": retryAfter }),
    dispose: vi.fn().mockResolvedValue(undefined),
  } as unknown as APIResponse;
}

describe("Playwright booking cooldowns", () => {
  it("waits the full 60 second refusal before sending the same request again", async () => {
    const refused = response(429);
    const accepted = response(200);
    const send = vi.fn().mockResolvedValueOnce(refused).mockResolvedValueOnce(accepted);
    const wait = vi.fn().mockResolvedValue(undefined);
    expect(await withRateLimitRetry(send, wait)).toBe(accepted);
    expect(wait).toHaveBeenCalledWith(60_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(refused.dispose).toHaveBeenCalledOnce();
  });

  it("supports HTTP dates and does not shorten a cooldown", () => {
    const now = Date.UTC(2026, 10, 1, 8, 20);
    expect(rateLimitDelayMs("Sun, 01 Nov 2026 08:21:00 GMT", now)).toBe(60_000);
    expect(rateLimitDelayMs("120", now)).toBe(120_000);
    expect(rateLimitDelayMs(undefined, now)).toBe(60_000);
    expect(rateLimitDelayMs("invalid", now)).toBe(60_000);
  });

  it("returns exhausted refusals so the original assertions still fail", async () => {
    const refused = response(429);
    const send = vi.fn().mockResolvedValue(refused);
    expect(await withRateLimitRetry(send, vi.fn().mockResolvedValue(undefined))).toBe(refused);
    expect(send).toHaveBeenCalledTimes(2);
    expect(refused.status()).toBe(429);
  });

  it.each([200, 400, 403, 409, 500])("does not replay HTTP %i", async (status) => {
    const result = response(status);
    const send = vi.fn().mockResolvedValue(result);
    const wait = vi.fn();
    expect(await withRateLimitRetry(send, wait)).toBe(result);
    expect(send).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });
});