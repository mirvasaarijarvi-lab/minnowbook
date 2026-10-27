import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithColdStartRetry, retryingFetch } from "./cold-start-retry";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cold-start retry helper", () => {
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
