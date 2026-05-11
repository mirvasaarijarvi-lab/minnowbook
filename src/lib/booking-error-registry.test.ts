/**
 * Unit tests for the centralized booking error registry.
 *
 * Verifies that:
 *  - Every entry in `BOOKING_ERROR_CODES` has a matching registry row.
 *  - `resolveBookingError` returns the correct descriptor for known
 *    codes and falls back gracefully for unknown / malformed errors.
 *  - The fallback never asks PublicBooking to pin its misconfig
 *    banner or emit telemetry.
 *  - `extractBookingErrorCode` is defensive against junk shapes.
 */

import { describe, it, expect } from "vitest";
import {
  BOOKING_ERROR_CODES,
  BOOKING_ERROR_REGISTRY,
  extractBookingErrorCode,
  resolveBookingError,
} from "./booking-error-registry";

describe("BOOKING_ERROR_REGISTRY", () => {
  it("has a registry entry for every known booking error code", () => {
    for (const code of Object.values(BOOKING_ERROR_CODES)) {
      expect(BOOKING_ERROR_REGISTRY).toHaveProperty(code);
    }
  });

  it("maps SERVICE_ROLE_KEY_MISSING to the misconfig descriptor", () => {
    const desc = resolveBookingError({
      code: BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
    });
    expect(desc).toEqual({
      code: BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
      i18nKey: "booking.serviceMisconfigured",
      toastDuration: 10000,
      pinMisconfigBanner: true,
      emitTelemetry: true,
    });
  });

  it("falls back to the generic submit error for unknown codes", () => {
    const desc = resolveBookingError({ code: "SOMETHING_NEW" });
    expect(desc).toEqual({
      code: null,
      i18nKey: "booking.submitError",
      toastDuration: 4000,
      pinMisconfigBanner: false,
      emitTelemetry: false,
    });
  });

  it("falls back when the error is null, undefined, or oddly shaped", () => {
    for (const err of [null, undefined, {}, "string-error", 42, { code: 123 }]) {
      const desc = resolveBookingError(err);
      expect(desc.code).toBeNull();
      expect(desc.i18nKey).toBe("booking.submitError");
      expect(desc.pinMisconfigBanner).toBe(false);
      expect(desc.emitTelemetry).toBe(false);
    }
  });

  it("extractBookingErrorCode only returns known codes", () => {
    expect(
      extractBookingErrorCode({ code: BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING }),
    ).toBe(BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING);
    expect(extractBookingErrorCode({ code: "UNKNOWN" })).toBeNull();
    expect(extractBookingErrorCode(null)).toBeNull();
    expect(extractBookingErrorCode(undefined)).toBeNull();
  });

  it("never pins the misconfig banner for non-misconfig errors", () => {
    const desc = resolveBookingError(new Error("network down"));
    expect(desc.pinMisconfigBanner).toBe(false);
    expect(desc.emitTelemetry).toBe(false);
  });
});
