import type { TranslationKey } from "@/i18n/translations";
import { BOOKING_ERROR_CODES, type BookingErrorCode } from "../../supabase/functions/_shared/booking-error-codes";

/**
 * Maps a booking error thrown by the public booking mutation to the
 * i18n key whose value should be shown in the toast.
 *
 * Extracted from `PublicBooking.tsx` so the routing logic can be unit
 * tested across all locales without mounting the entire 2400 line
 * page. The page's `onError` handler is now a one liner that calls
 * this helper and passes the resolved key into `t()`.
 */
export function getBookingErrorToastKey(err: unknown): TranslationKey {
  const code = (err as { code?: string } | null | undefined)?.code;
  if (code === BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING) {
    return "booking.serviceMisconfigured";
  }
  return "booking.submitError";
}

/**
 * `sonner` toast options for each error key. Centralized here so the
 * misconfig toast keeps its long duration regardless of which call
 * site renders it.
 */
export function getBookingErrorToastOptions(err: unknown): { duration: number } {
  const code = (err as { code?: string } | null | undefined)?.code;
  if (code === BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING) {
    return { duration: 10000 };
  }
  return { duration: 4000 };
}

export type { BookingErrorCode };
export { BOOKING_ERROR_CODES };
