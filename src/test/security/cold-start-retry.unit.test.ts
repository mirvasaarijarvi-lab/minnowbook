import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithColdStartRetry, retryingFetch } from "./cold-start-retry";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cold-start retry helper", () => {
  it("waits the full 60-second Retry-After cooldown without shortening it", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{}", { status: 429, headers: { "retry-after": "60" } }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = fetchWithColdStartRetry("https://example.test/probe", {});
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors an HTTP-date Retry-After", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T08:00:00Z"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 429,
          headers: { "retry-after": "Fri, 13 Nov 2026 08:01:00 GMT" },
        }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = fetchWithColdStartRetry("https://example.test/probe", {});
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).status).toBe(403);
  });

  it("returns the final refusal after four attempts instead of manufacturing success", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response("limited", {
          status: 429,
          headers: { "retry-after": "60" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const pending = fetchWithColdStartRetry("https://example.test/probe", {});
    await vi.advanceTimersByTimeAsync(180_000);
    const final = await pending;
    expect(final.status).toBe(429);
    expect(await final.text()).toBe("limited");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("surfaces exhausted per-attempt timeouts as a failing 504 response", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const fetchMock = vi.fn().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("timed out", "AbortError")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const pending = fetchWithColdStartRetry("https://example.test/probe", {});
    await vi.advanceTimersByTimeAsync(38_500);
    expect((await pending).status).toBe(504);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("retries a dropped connection and returns the next response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithColdStartRetry("https://example.test/x", {});
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a platform rate-limit (429) reply", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{}", { status: 429, headers: { "retry-after": "0.01" } }),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithColdStartRetry("https://example.test/x", {});
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a real 4xx answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await retryingFetch("https://example.test/x", {});
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still surfaces non-network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new RangeError("bad input")),
    );
    await expect(
      fetchWithColdStartRetry("https://example.test/x", {}),
    ).rejects.toThrow("bad input");
  });
});
