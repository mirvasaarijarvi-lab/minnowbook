/**
 * Accommodation revenue split used by period reports.
 *
 * `price_eur` on a reservation is always the total the guest is charged for the
 * whole stay: the public booking function and the manual reservation dialog both
 * derive it from the resource's configured room price x nights (+ breakfast).
 * Reports therefore must never multiply it by nights again, and must never add
 * breakfast on top: the room line is the stored total minus the breakfast
 * component, so room + breakfast always equals the guest-charged amount.
 */

export interface AccommodationPricingRow {
  reservation_type: string;
  date: string;
  check_out_date?: string | null;
  guests_count?: number | null;
  breakfast_included?: boolean | null;
  breakfast_price_per_person?: number | null;
  price_eur?: number | null;
}

export const DEFAULT_BREAKFAST_PRICE_PER_PERSON = 15;

export const isAccommodationRow = (r: Pick<AccommodationPricingRow, "reservation_type">) =>
  r.reservation_type === "guesthouse" || r.reservation_type === "hotel";

/** Nights between check-in and check-out; at least 1 (same-day or missing date). */
export const calcNights = (r: Pick<AccommodationPricingRow, "date" | "check_out_date">) => {
  if (!r.check_out_date) return 1;
  const d = Math.round(
    (new Date(r.check_out_date + "T00:00:00").getTime() - new Date(r.date + "T00:00:00").getTime()) /
      86400000,
  );
  return d > 0 ? d : 1;
};

/** Breakfast component of the stored total: price per person x guests x nights. */
export const calcBreakfastPrice = (r: AccommodationPricingRow) => {
  if (!r.breakfast_included || !isAccommodationRow(r)) return 0;
  return (
    (r.breakfast_price_per_person ?? DEFAULT_BREAKFAST_PRICE_PER_PERSON) *
    (r.guests_count ?? 1) *
    calcNights(r)
  );
};

/** Room component: the stored total minus breakfast, never negative. */
export const calcRoomPrice = (r: AccommodationPricingRow) => {
  const total = r.price_eur ?? 0;
  if (!isAccommodationRow(r)) return total;
  return Math.max(0, total - calcBreakfastPrice(r));
};
