import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import ConfirmationEmailPreview, {
  isPersistedPublicBrandingUrl,
  SIGNED_URL_MARKERS,
} from "@/components/ConfirmationEmailPreview";

/**
 * Contract test: ConfirmationEmailPreview MUST embed branding via a persisted
 * public URL (e.g. the tenant-assets bucket public URL). The public booking
 * page is the place that uses short-lived signed URLs; emails cannot, because
 * they outlive any signed-URL TTL once they land in a recipient's inbox.
 *
 * If a future change starts piping signed URLs into this preview the dev
 * console.warn must fire and these assertions must fail.
 */

const baseReservation = {
  guest_name: "Alice",
  guest_email: "alice@example.com",
  date: "2025-06-01",
  reservation_type: "restaurant",
  guests_count: 2,
};

const PUBLIC_LOGO =
  "https://lsgznskkxadplwnxplhd.supabase.co/storage/v1/object/public/tenant-assets/tenant-1/logo.png";

const SIGNED_LOGO =
  "https://lsgznskkxadplwnxplhd.supabase.co/storage/v1/object/sign/tenant-private/tenant-1/logo.png?token=eyJhbGci";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("isPersistedPublicBrandingUrl", () => {
  it("accepts undefined / null / empty (logo is simply hidden)", () => {
    expect(isPersistedPublicBrandingUrl(undefined)).toBe(true);
    expect(isPersistedPublicBrandingUrl(null)).toBe(true);
    expect(isPersistedPublicBrandingUrl("")).toBe(true);
  });

  it("accepts the persisted public tenant-assets URL", () => {
    expect(isPersistedPublicBrandingUrl(PUBLIC_LOGO)).toBe(true);
  });

  it("rejects Supabase signed object URLs", () => {
    expect(isPersistedPublicBrandingUrl(SIGNED_LOGO)).toBe(false);
  });

  it("rejects every documented signed-URL marker", () => {
    for (const marker of SIGNED_URL_MARKERS) {
      const url = `https://cdn.example.com/logo.png?${marker}=abc`;
      expect(
        isPersistedPublicBrandingUrl(url),
        `expected ${marker} to be rejected`,
      ).toBe(false);
    }
  });

  it("rejects S3-style presigned URLs", () => {
    const url =
      "https://bucket.s3.amazonaws.com/logo.png?X-Amz-Signature=deadbeef&X-Amz-Expires=3600";
    expect(isPersistedPublicBrandingUrl(url)).toBe(false);
  });
});

describe("ConfirmationEmailPreview branding URL contract", () => {
  it("renders the persisted public logo URL verbatim into the <img src>", () => {
    const { container } = render(
      <ConfirmationEmailPreview
        reservation={baseReservation}
        business={{ business_name: "Bistro", logo_url: PUBLIC_LOGO }}
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(PUBLIC_LOGO);
    // Sanity: nothing in the rendered tree should contain a signed-URL marker
    for (const marker of SIGNED_URL_MARKERS) {
      expect(container.innerHTML.toLowerCase()).not.toContain(marker.toLowerCase());
    }
  });

  it("warns in dev when a signed URL is passed instead of a persisted public URL", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <ConfirmationEmailPreview
        reservation={baseReservation}
        business={{ business_name: "Bistro", logo_url: SIGNED_LOGO }}
      />,
    );
    // The warning is gated on import.meta.env.DEV (true in vitest).
    expect(warn).toHaveBeenCalled();
    const message = warn.mock.calls.map((c) => String(c[0])).join("\n");
    expect(message).toMatch(/signed\/expiring URL/i);
  });

  it("does not warn when no logo is provided", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <ConfirmationEmailPreview
        reservation={baseReservation}
        business={{ business_name: "Bistro" }}
      />,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
