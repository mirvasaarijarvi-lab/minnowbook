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
  typeof BOOKING_ERROR_CODES[keyof typeof BOOKING_ERROR_CODES];
