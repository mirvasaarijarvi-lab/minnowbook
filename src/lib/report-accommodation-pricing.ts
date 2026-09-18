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
  /** Restaurant "according to menu" bookings carry no fixed amount. */
  pricing_type?: string | null;
}

export const DEFAULT_BREAKFAST_PRICE_PER_PERSON = 15;

export const isAccommodationRow = (
  r: Pick<AccommodationPricingRow, "reservation_type">,
) => r.reservation_type === "guesthouse" || r.reservation_type === "hotel";

/** Nights between check-in and check-out; at least 1 (same-day or missing date). */
export const calcNights = (
  r: Pick<AccommodationPricingRow, "date" | "check_out_date">,
) => {
  if (!r.check_out_date) return 1;
  const d = Math.round(
    (new Date(r.check_out_date + "T00:00:00").getTime() -
      new Date(r.date + "T00:00:00").getTime()) /
      86400000,
  );
  return d > 0 ? d : 1;
};

/**
 * Round to whole cents. Reports are money, so every figure is snapped to a cent
 * before it is shown or summed; this also removes binary floating point dust
 * (0.1 * 3 = 0.30000000000000004) that would otherwise make the room line and
 * the breakfast line miss the charged total by a fraction of a cent.
 */
export const roundCents = (n: number) => {
  if (!Number.isFinite(n)) return 0;
  return (
    Math.round((n + Number.EPSILON * Math.sign(n) * Math.abs(n)) * 100) / 100
  );
};

/** The charged amount, snapped to cents: room + breakfast always equals this. */
export const calcChargedTotal = (
  r: Pick<AccommodationPricingRow, "price_eur">,
) => roundCents(r.price_eur ?? 0);

/**
 * Breakfast component of the stored total: price per person x guests x nights,
 * rounded to cents and never more than the charged total (so the room line can
 * stay non-negative without the split drifting away from the total).
 */
export const calcBreakfastPrice = (r: AccommodationPricingRow) => {
  if (!r.breakfast_included || !isAccommodationRow(r)) return 0;
  const raw = roundCents(
    (r.breakfast_price_per_person ?? DEFAULT_BREAKFAST_PRICE_PER_PERSON) *
      (r.guests_count ?? 1) *
      calcNights(r),
  );
  const total = calcChargedTotal(r);
  if (raw <= 0) return 0;
  return Math.min(raw, Math.max(0, total));
};

/** Room component: the charged total minus breakfast, never negative. */
export const calcRoomPrice = (r: AccommodationPricingRow) => {
  const total = calcChargedTotal(r);
  if (!isAccommodationRow(r)) return total;
  return roundCents(Math.max(0, total - calcBreakfastPrice(r)));
};

/**
 * The amount a report shows for a booking, in cents-exact euros. Every report
 * surface (screen table, CSV, print view, PDF export and the grand total) must
 * use this single function, so the accommodation room + breakfast split always
 * adds up to the very same figure the guest is charged.
 *
 * Restaurant "according to menu" bookings have no fixed amount, so they count
 * as 0 rather than as an invented price.
 */
export const effectiveChargedTotal = (r: AccommodationPricingRow) => {
  if (r.reservation_type === "restaurant" && r.pricing_type === "menu")
    return 0;
  return calcChargedTotal(r);
};
