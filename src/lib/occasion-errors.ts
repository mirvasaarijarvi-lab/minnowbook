/**
 * Guest-facing copy for special-occasion refusals.
 *
 * The public-booking edge function answers a refused occasion booking
 * with `error_code` (one of `OCCASION_ERROR_CODES`) plus an `occasion`
 * payload carrying the occasion name, the seats still left and the
 * sitting times it offers. This module turns that wire data into a
 * localized, actionable sentence, so the booking page never forwards
 * the English server fallback copy to a guest.
 */

import type { TranslationKey } from "@/i18n/translations";
import {
  OCCASION_ERROR_CODES,
  type OccasionErrorCode,
  type OccasionErrorContext,
} from "../../supabase/functions/_shared/booking-error-codes";

export type OccasionErrorInfo = {
  code: OccasionErrorCode;
  /** Seats still available, when the server reported a number. */
  remaining: number | null;
  /** Occasion name, when known. */
  name: string | null;
  /** Sitting times the occasion offers (HH:MM). */
  seatingTimes: string[];
};

const CODE_TO_KEY: Record<OccasionErrorCode, TranslationKey> = {
  [OCCASION_ERROR_CODES.OCCASION_UNAVAILABLE]: "booking.occasionErrUnavailable",
  [OCCASION_ERROR_CODES.OCCASION_WRONG_DATE]: "booking.occasionErrWrongDate",
  [OCCASION_ERROR_CODES.OCCASION_WRONG_TYPE]: "booking.occasionErrWrongType",
  [OCCASION_ERROR_CODES.OCCASION_SEATING_REQUIRED]:
    "booking.occasionErrSeatingRequired",
  [OCCASION_ERROR_CODES.OCCASION_SEATING_UNAVAILABLE]:
    "booking.occasionErrSeatingUnavailable",
  [OCCASION_ERROR_CODES.OCCASION_FULL]: "booking.occasionErrFull",
};

/** True when the given string is a known occasion error code. */
export function isOccasionErrorCode(code: unknown): code is OccasionErrorCode {
  return (
    typeof code === "string" &&
    Object.prototype.hasOwnProperty.call(CODE_TO_KEY, code)
  );
}

/**
 * Read an occasion refusal off an arbitrary thrown value. Returns null
 * when the error is not an occasion refusal, so callers can fall back
 * to the general booking error registry.
 */
export function parseOccasionError(err: unknown): OccasionErrorInfo | null {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (!isOccasionErrorCode(code)) return null;
  const ctx = ((err as { occasion?: OccasionErrorContext }).occasion ??
    {}) as OccasionErrorContext;
  const remaining =
    typeof ctx.remaining === "number" && Number.isFinite(ctx.remaining)
      ? ctx.remaining
      : null;
  return {
    code,
    remaining,
    name: typeof ctx.name === "string" && ctx.name.length > 0 ? ctx.name : null,
    seatingTimes: Array.isArray(ctx.seatingTimes)
      ? ctx.seatingTimes.map((t) => String(t).slice(0, 5))
      : [],
  };
}

/**
 * Pick the translation key for a refusal. A full occasion that still
 * has some seats left gets the "only N seats left" variant, which
 * tells a large party what to do next.
 */
export function occasionErrorTranslationKey(
  info: OccasionErrorInfo,
): TranslationKey {
  if (
    info.code === OCCASION_ERROR_CODES.OCCASION_FULL &&
    typeof info.remaining === "number" &&
    info.remaining > 0
  ) {
    return "booking.occasionErrFullWithSeats";
  }
  return CODE_TO_KEY[info.code];
}

/**
 * Fill the `{seats}`, `{name}` and `{times}` placeholders. Unknown
 * values are dropped rather than rendered as literal placeholders.
 */
export function applyOccasionErrorPlaceholders(
  template: string,
  info: OccasionErrorInfo,
): string {
  return template
    .replace(
      /\{seats\}/g,
      info.remaining === null ? "0" : String(info.remaining),
    )
    .replace(/\{name\}/g, info.name ?? "")
    .replace(/\{times\}/g, info.seatingTimes.join(", "))
    .trim();
}

export { OCCASION_ERROR_CODES };
export type { OccasionErrorCode };
