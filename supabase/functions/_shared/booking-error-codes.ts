/**
 * Shared booking error codes.
 *
 * Single source of truth used by BOTH the `public-booking` Deno edge
 * function and the React frontend so the wire contract for
 * `error_code` values cannot drift between sides.
 *
 * Pure module: no Deno- or Node-specific imports, so it can be
 * consumed by the Vite client bundle via a relative import as well as
 * by the Supabase edge function runtime.
 */

export const BOOKING_ERROR_CODES = {
  /**
   * The edge function detected that `SUPABASE_SERVICE_ROLE_KEY` is
   * missing or empty and refused to perform any DB write. The SPA
   * uses this to show a precise misconfiguration message instead of
   * a generic submit-failed toast.
   */
  SERVICE_ROLE_KEY_MISSING: "SERVICE_ROLE_KEY_MISSING",
} as const;

export type BookingErrorCode =
  | OccasionErrorCode
  typeof BOOKING_ERROR_CODES[keyof typeof BOOKING_ERROR_CODES];

/**
 * Structured codes for special-occasion refusals. The edge function
 * attaches these plus an `occasion` payload (name, remaining seats,
 * offered sitting times) so the booking page can render a precise,
 * localized explanation instead of forwarding English server copy.
 */
export const OCCASION_ERROR_CODES = {
  OCCASION_UNAVAILABLE: "OCCASION_UNAVAILABLE",
  OCCASION_WRONG_DATE: "OCCASION_WRONG_DATE",
  OCCASION_WRONG_TYPE: "OCCASION_WRONG_TYPE",
  OCCASION_SEATING_REQUIRED: "OCCASION_SEATING_REQUIRED",
  OCCASION_SEATING_UNAVAILABLE: "OCCASION_SEATING_UNAVAILABLE",
  OCCASION_FULL: "OCCASION_FULL",
} as const;

export type OccasionErrorCode =
  typeof OCCASION_ERROR_CODES[keyof typeof OCCASION_ERROR_CODES];

/** Maps a `validateOccasionBooking` refusal reason to a wire code. */
export const OCCASION_REASON_TO_CODE: Record<string, OccasionErrorCode> = {
  NOT_FOUND: OCCASION_ERROR_CODES.OCCASION_UNAVAILABLE,
  INACTIVE: OCCASION_ERROR_CODES.OCCASION_UNAVAILABLE,
  WRONG_DATE: OCCASION_ERROR_CODES.OCCASION_WRONG_DATE,
  WRONG_TYPE: OCCASION_ERROR_CODES.OCCASION_WRONG_TYPE,
  SEATING_REQUIRED: OCCASION_ERROR_CODES.OCCASION_SEATING_REQUIRED,
  INVALID_SEATING: OCCASION_ERROR_CODES.OCCASION_SEATING_UNAVAILABLE,
  FULL: OCCASION_ERROR_CODES.OCCASION_FULL,
};

/** Payload carried alongside an occasion error code. */
export type OccasionErrorContext = {
  name?: string | null;
  remaining?: number | null;
  seatingTimes?: string[];
  seating?: string | null;
};
