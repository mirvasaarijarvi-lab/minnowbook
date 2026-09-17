/**
 * The single pricing accessor for every report surface.
 *
 * On-screen table, CSV export, print view, PDF export, KPI cards and period
 * totals must all read money through `reportAmounts` (and sum it through
 * `sumReportAmounts`). No report view may do its own arithmetic on
 * `price_eur`, multiply by nights, or add breakfast on top: those are exactly
 * the mistakes that made one figure disagree with another.
 *
 * Guarantees per booking:
 *   charged   = the amount the guest is charged, snapped to whole cents
 *               (restaurant "according to menu" bookings carry no amount)
 *   room      = charged minus breakfast, never negative
 *   breakfast = stored rate x guests x nights, capped at charged
 *   room + breakfast === charged, always, to the cent
 *
 * `src/lib/report-export-consistency.test.ts` and
 * `src/lib/report-pricing-accessor.test.ts` fail if any view recomputes
 * amounts separately.
 */

import {
  type AccommodationPricingRow,
  calcBreakfastPrice,
  calcNights,
  calcRoomPrice,
  effectiveChargedTotal,
  isAccommodationRow,
  roundCents,
} from "./report-accommodation-pricing";

export type ReportPricingRow = AccommodationPricingRow;

export interface ReportAmounts {
  /** What the guest is charged, cents-exact. */
  charged: number;
  /** Room component of `charged` (equals `charged` for non-accommodation). */
  room: number;
  /** Breakfast component of `charged`; 0 when no breakfast. */
  breakfast: number;
  /** Nights of the stay, at least 1. */
  nights: number;
  /** True for guesthouse and hotel bookings. */
  isAccommodation: boolean;
  /** True when there is an amount worth showing (> 0). */
  hasAmount: boolean;
}

/** Every money figure a report shows for one booking, from one place. */
export const reportAmounts = (r: ReportPricingRow): ReportAmounts => {
  const charged = effectiveChargedTotal(r);
  const isAccommodation = isAccommodationRow(r);
  // A menu-priced restaurant booking has no amount, so it has no split either.
  const breakfast = charged > 0 ? calcBreakfastPrice(r) : 0;
  const room = charged > 0 ? (isAccommodation ? calcRoomPrice(r) : charged) : 0;
  return {
    charged,
    room,
    breakfast,
    nights: calcNights(r),
    isAccommodation,
    hasAmount: charged > 0,
  };
};

export interface ReportTotals {
  charged: number;
  room: number;
  breakfast: number;
  count: number;
}

/**
 * Sum amounts over a set of bookings in integer cents, so a period total can
 * never drift from the rows it is built from.
 */
export const sumReportAmounts = (rows: ReportPricingRow[]): ReportTotals => {
  let chargedCents = 0;
  let roomCents = 0;
  let breakfastCents = 0;
  for (const r of rows) {
    const a = reportAmounts(r);
    chargedCents += Math.round(a.charged * 100);
    roomCents += Math.round(a.room * 100);
    breakfastCents += Math.round(a.breakfast * 100);
  }
  return {
    charged: roundCents(chargedCents / 100),
    room: roundCents(roomCents / 100),
    breakfast: roundCents(breakfastCents / 100),
    count: rows.length,
  };
};

export { calcNights, isAccommodationRow, roundCents };
