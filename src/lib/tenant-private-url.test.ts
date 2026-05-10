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
  PRIVATE_SIGNED_URL_TTL_SECONDS,
} from "@/lib/tenant-private-url";

describe("tenant-private-url helper", () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
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
});
