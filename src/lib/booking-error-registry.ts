/**
 * Centralized booking error registry.
 *
 * Single source of truth that maps a `BookingErrorCode` (or any
 * unknown error thrown by the public-booking mutation) to everything
 * the UI needs to react consistently:
 *
 *  - `i18nKey`           which translation key to render in the toast
 *  - `toastDuration`     how long sonner should show the toast (ms)
 *  - `pinMisconfigBanner` whether PublicBooking should set its inline
 *                        "no reservation was created" banner
 *  - `emitTelemetry`     whether `trackBookingError` should fire
 *
 * Adding a new structured `error_code` in the edge function is a
 * two-step change:
 *   1. Add the literal to `supabase/functions/_shared/booking-error-codes.ts`.
 *   2. Add a row to `BOOKING_ERROR_REGISTRY` below.
 *
 * PublicBooking and any other client that talks to the public-booking
 * endpoint should call `resolveBookingError(err)` instead of
 * branching on `err.code` directly, so mapping logic cannot drift
 * across call sites.
 */

import type { TranslationKey } from "@/i18n/translations";
import {
  BOOKING_ERROR_CODES,
  type BookingErrorCode,
} from "../../supabase/functions/_shared/booking-error-codes";

export type BookingErrorDescriptor = {
  /** The structured code if one was attached to the error, else null. */
  code: BookingErrorCode | null;
  /** i18n translation key to render in the user-facing toast. */
  i18nKey: TranslationKey;
  /** sonner toast duration in milliseconds. */
  toastDuration: number;
  /**
   * Whether PublicBooking should pin its inline "service is
   * misconfigured, no reservation was created" banner and disable
   * follow-up submits.
   */
  pinMisconfigBanner: boolean;
  /**
   * Whether the lightweight telemetry event should be emitted. We
   * always emit when there is a structured code so we can track
   * frequency of known failure modes without leaking secrets.
   */
  emitTelemetry: boolean;
};

type RegistryEntry = Omit<BookingErrorDescriptor, "code">;

/**
 * Default descriptor used when the error has no recognised
 * `error_code`. Renders the generic "submit failed" toast.
 */
const FALLBACK_ENTRY: RegistryEntry = {
  i18nKey: "booking.submitError",
  toastDuration: 4000,
  pinMisconfigBanner: false,
  emitTelemetry: false,
};

/**
 * The actual mapping. Keep entries terse and well commented so the
 * UI behaviour for each wire-level error stays obvious.
 */
export const BOOKING_ERROR_REGISTRY: Record<BookingErrorCode, RegistryEntry> = {
  [BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING]: {
    i18nKey: "booking.serviceMisconfigured",
    // Long duration so the guest has time to read the admin steps.
    toastDuration: 10000,
    pinMisconfigBanner: true,
    emitTelemetry: true,
  },
};

/**
 * Pull the structured `code` off an arbitrary thrown value without
 * trusting its shape. Returns the literal if it is one of the known
 * `BookingErrorCode` values, otherwise `null`.
 */
export function extractBookingErrorCode(err: unknown): BookingErrorCode | null {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (typeof code !== "string") return null;
  if (Object.prototype.hasOwnProperty.call(BOOKING_ERROR_REGISTRY, code)) {
    return code as BookingErrorCode;
  }
  return null;
}

/**
 * Resolve the full descriptor for an error thrown by the public
 * booking mutation. Always returns something usable, never throws.
 */
export function resolveBookingError(err: unknown): BookingErrorDescriptor {
  const code = extractBookingErrorCode(err);
  const entry = code ? BOOKING_ERROR_REGISTRY[code] : FALLBACK_ENTRY;
  return { code, ...entry };
}

export { BOOKING_ERROR_CODES };
export type { BookingErrorCode };
