import { describe, it, expect, vi, beforeEach } from "vitest";

const createSignedUrl = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ createSignedUrl }),
    },
  },
}));

import {
  createTenantPrivateSignedUrl,
  clearTenantPrivateSignedUrlCache,
  invalidateTenantPrivateSignedUrl,
  PRIVATE_SIGNED_URL_TTL_SECONDS,
} from "@/lib/tenant-private-url";

describe("tenant-private-url helper", () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
    clearTenantPrivateSignedUrlCache();
    vi.useRealTimers();
  });

  it("uses a 24h TTL by default", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example/sig" },
      error: null,
    });
    await createTenantPrivateSignedUrl("tenant-123/offer.pdf");
    expect(PRIVATE_SIGNED_URL_TTL_SECONDS).toBe(86_400);
    expect(createSignedUrl).toHaveBeenCalledWith(
      "tenant-123/offer.pdf",
      86_400,
      { download: undefined },
    );
  });

  it("caps oversized TTLs at 7 days", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example/sig" },
      error: null,
    });
    await createTenantPrivateSignedUrl("a/b.pdf", {
      expiresInSeconds: 9_999_999,
    });
    expect(createSignedUrl).toHaveBeenCalledWith(
      "a/b.pdf",
      7 * 24 * 60 * 60,
      { download: undefined },
    );
  });

  it("rejects empty paths", async () => {
    await expect(createTenantPrivateSignedUrl("")).rejects.toThrow(/path/);
  });

  it("surfaces underlying storage errors", async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });
    await expect(createTenantPrivateSignedUrl("missing.pdf")).rejects.toThrow(
      /not found/,
    );
  });

  it("re-uses cached URLs across repeated calls", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example/sig-1" },
      error: null,
    });
    const a = await createTenantPrivateSignedUrl("cache/a.png");
    const b = await createTenantPrivateSignedUrl("cache/a.png");
    expect(a).toBe(b);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent in-flight requests", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example/sig-concurrent" },
      error: null,
    });
    const [a, b] = await Promise.all([
      createTenantPrivateSignedUrl("cache/concurrent.png"),
      createTenantPrivateSignedUrl("cache/concurrent.png"),
    ]);
    expect(a).toBe(b);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("renews the URL once it nears expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "https://example/v1" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "https://example/v2" }, error: null });

    const first = await createTenantPrivateSignedUrl("cache/renew.png", {
      expiresInSeconds: 600, // 10 minutes
    });
    expect(first).toBe("https://example/v1");

    // Advance 9 minutes, well inside the 5-minute renewal window.
    vi.setSystemTime(new Date("2026-01-01T00:09:00Z"));
    const second = await createTenantPrivateSignedUrl("cache/renew.png", {
      expiresInSeconds: 600,
    });
    expect(second).toBe("https://example/v2");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("forceRefresh bypasses the cache", async () => {
    createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "https://example/v1" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "https://example/v2" }, error: null });
    await createTenantPrivateSignedUrl("cache/force.png");
    const fresh = await createTenantPrivateSignedUrl("cache/force.png", {
      forceRefresh: true,
    });
    expect(fresh).toBe("https://example/v2");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("invalidate drops a single cached entry", async () => {
    createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "https://example/v1" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "https://example/v2" }, error: null });
    await createTenantPrivateSignedUrl("cache/invalidate.png");
    invalidateTenantPrivateSignedUrl("cache/invalidate.png");
    const next = await createTenantPrivateSignedUrl("cache/invalidate.png");
    expect(next).toBe("https://example/v2");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });
});

describe("tenant-private-url SignedUrlError contract", () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
    clearTenantPrivateSignedUrlCache();
  });

  it("invalid path -> code 'invalid_path'", async () => {
    // path-traversal style input is rejected by assertSafeStorageObjectPath
    await expect(
      createTenantPrivateSignedUrl("../etc/passwd"),
    ).rejects.toMatchObject({ name: "SignedUrlError", code: "invalid_path" });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("SDK 403 -> code 'forbidden' with httpStatus 403", async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "permission denied for object", status: 403 },
    });
    await expect(
      createTenantPrivateSignedUrl("tenant-1/secret.bin"),
    ).rejects.toMatchObject({ name: "SignedUrlError", code: "forbidden", httpStatus: 403 });
  });

  it("SDK 404 -> code 'not_found'", async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Object not found", status: 404 },
    });
    await expect(
      createTenantPrivateSignedUrl("tenant-1/missing.bin"),
    ).rejects.toMatchObject({ name: "SignedUrlError", code: "not_found", httpStatus: 404 });
  });

  it("thrown TypeError('fetch failed') -> code 'transport'", async () => {
    createSignedUrl.mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      createTenantPrivateSignedUrl("tenant-1/transport.bin"),
    ).rejects.toMatchObject({ name: "SignedUrlError", code: "transport" });
  });

  it("dropped cache after a classified failure (next call retries)", async () => {
    createSignedUrl
      .mockResolvedValueOnce({ data: null, error: { message: "permission denied", status: 403 } })
      .mockResolvedValueOnce({ data: { signedUrl: "https://example/recovered" }, error: null });
    await expect(
      createTenantPrivateSignedUrl("tenant-1/retry.bin"),
    ).rejects.toMatchObject({ code: "forbidden" });
    const ok = await createTenantPrivateSignedUrl("tenant-1/retry.bin");
    expect(ok).toBe("https://example/recovered");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });
});
