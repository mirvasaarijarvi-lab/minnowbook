import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

import { invokeWithRetry, shouldRetryError } from "./invoke-with-retry";

function gatewayError(status: number) {
  return {
    name: "FunctionsHttpError",
    message: `Edge Function returned a non-2xx status code: ${status}`,
    context: { status },
  };
}

describe("invokeWithRetry", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("returns immediately on success", async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const res = await invokeWithRetry("fn", { body: {} });
    expect(res.error).toBeNull();
    expect(res.attempts).toBe(1);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it.each([502, 503, 504])("retries on transient %s and eventually succeeds", async (status) => {
    invokeMock
      .mockResolvedValueOnce({ data: null, error: gatewayError(status) })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const res = await invokeWithRetry("fn", { body: {} }, { baseDelayMs: 1, maxDelayMs: 2 });
    expect(res.error).toBeNull();
    expect(res.attempts).toBe(2);
  });

  it("fails fast on 401 (no retry)", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: gatewayError(401) });
    const res = await invokeWithRetry("fn", { body: {} }, { baseDelayMs: 1 });
    expect(res.error).toBeTruthy();
    expect(res.attempts).toBe(1);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("fails fast on 400 validation errors", async () => {
    invokeMock.mockResolvedValueOnce({ data: { error: "bad input" }, error: gatewayError(400) });
    const res = await invokeWithRetry("fn", { body: {} }, { baseDelayMs: 1 });
    expect(res.attempts).toBe(1);
  });

  it("gives up after maxAttempts on persistent 502", async () => {
    invokeMock.mockResolvedValue({ data: null, error: gatewayError(502) });
    const res = await invokeWithRetry("fn", { body: {} }, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 });
    expect(res.attempts).toBe(3);
    expect(invokeMock).toHaveBeenCalledTimes(3);
  });

  it("retries bare network errors", async () => {
    invokeMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const res = await invokeWithRetry("fn", { body: {} }, { baseDelayMs: 1 });
    expect(res.error).toBeNull();
    expect(res.attempts).toBe(2);
  });

  it("does not retry on AbortError", async () => {
    const ac = new AbortController();
    invokeMock.mockImplementation(() => {
      ac.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    const res = await invokeWithRetry("fn", { body: {} }, { signal: ac.signal, baseDelayMs: 1 });
    expect(res.attempts).toBe(1);
  });

  it("shouldRetryError classifies statuses correctly", async () => {
    expect(await shouldRetryError(gatewayError(502))).toBe(true);
    expect(await shouldRetryError(gatewayError(503))).toBe(true);
    expect(await shouldRetryError(gatewayError(504))).toBe(true);
    expect(await shouldRetryError(gatewayError(429))).toBe(true);
    expect(await shouldRetryError(gatewayError(401))).toBe(false);
    expect(await shouldRetryError(gatewayError(400))).toBe(false);
    expect(await shouldRetryError(gatewayError(409))).toBe(false);
  });
});
