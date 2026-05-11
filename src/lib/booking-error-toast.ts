/**
 * Thin compatibility wrappers around `resolveBookingError`.
 *
 * These were the original helpers used by `PublicBooking.tsx` and its
 * tests. They now defer to the centralized `BOOKING_ERROR_REGISTRY`
 * so all booking-error mapping decisions live in exactly one place.
 * Keeping the function names stable means the existing test suite in
 * `booking-error-toast.test.tsx` keeps exercising the same surface.
 */

import type { TranslationKey } from "@/i18n/translations";
import {
  BOOKING_ERROR_CODES,
  resolveBookingError,
  type BookingErrorCode,
} from "./booking-error-registry";

export function getBookingErrorToastKey(err: unknown): TranslationKey {
  return resolveBookingError(err).i18nKey;
}

export function getBookingErrorToastOptions(err: unknown): { duration: number } {
  return { duration: resolveBookingError(err).toastDuration };
}

export type { BookingErrorCode };
export { BOOKING_ERROR_CODES };
