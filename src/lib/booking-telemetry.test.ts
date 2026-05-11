/**
 * Unit tests for the booking telemetry helper.
 *
 * We verify that:
 *  - The `SERVICE_ROLE_KEY_MISSING` event is pushed onto
 *    `window.dataLayer` with the expected shape.
 *  - No secret-ish fields (form values, server messages, stack
 *    traces, auth headers) leak into the emitted payload.
 *  - The helper is fire-and-forget and never throws, even when
 *    `dataLayer.push` itself blows up.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  buildBookingTelemetryEvent,
  trackBookingError,
  trackServiceRoleKeyMissing,
} from "./booking-telemetry";
import { BOOKING_ERROR_CODES } from "../../supabase/functions/_shared/booking-error-codes";

describe("booking telemetry", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("builds an event with stable shape and ISO timestamp", () => {
    const evt = buildBookingTelemetryEvent(
      BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
      { tenantSlug: "acme", resourceId: "r-1", locale: "en" },
    );
    expect(evt.event).toBe("booking_error");
    expect(evt.error_code).toBe("SERVICE_ROLE_KEY_MISSING");
    expect(evt.tenant_slug).toBe("acme");
    expect(evt.resource_id).toBe("r-1");
    expect(evt.locale).toBe("en");
    expect(() => new Date(evt.ts).toISOString()).not.toThrow();
  });

  it("pushes a SERVICE_ROLE_KEY_MISSING event onto window.dataLayer", () => {
    trackServiceRoleKeyMissing({ tenantSlug: "acme", locale: "fi" });
    const dl = (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
    expect(dl).toHaveLength(1);
    expect(dl[0]).toMatchObject({
      event: "booking_error",
      error_code: "SERVICE_ROLE_KEY_MISSING",
      tenant_slug: "acme",
      locale: "fi",
    });
  });

  it("never includes secret-ish fields in the payload", () => {
    trackBookingError(BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING, {
      tenantSlug: "acme",
      resourceId: "r-1",
      locale: "sv",
    });
    const dl = (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
    const payload = JSON.stringify(dl[0]);
    for (const banned of [
      "service_role",
      "SUPABASE_SERVICE_ROLE_KEY",
      "guest_email",
      "guest_phone",
      "guest_name",
      "Authorization",
      "Bearer",
      "stack",
    ]) {
      expect(payload).not.toContain(banned);
    }
  });

  it("logs a coarse console.warn so the signal survives ad-blockers", () => {
    trackServiceRoleKeyMissing({ tenantSlug: "acme" });
    expect(warnSpy).toHaveBeenCalledWith(
      "[booking-telemetry]",
      expect.objectContaining({
        event: "booking_error",
        error_code: "SERVICE_ROLE_KEY_MISSING",
      }),
    );
  });

  it("never throws even if dataLayer.push is broken", () => {
    Object.defineProperty(window, "dataLayer", {
      configurable: true,
      value: { push: () => { throw new Error("blocked"); } },
    });
    expect(() => trackServiceRoleKeyMissing()).not.toThrow();
  });

  it("omits optional context fields when not provided", () => {
    trackBookingError("SOME_OTHER_CODE");
    const dl = (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
    expect(dl[0]).not.toHaveProperty("tenant_slug");
    expect(dl[0]).not.toHaveProperty("resource_id");
    expect(dl[0]).not.toHaveProperty("locale");
    expect(dl[0].error_code).toBe("SOME_OTHER_CODE");
  });
});
