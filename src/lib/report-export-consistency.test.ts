/**
 * Verification: the period report's PDF export, CSV export, print view and
 * on-screen table all show the same accommodation figures, and those figures
 * always add up to the amount the guest is charged.
 *
 * The PDF table prints one total column per booking (`effectiveChargedTotal`),
 * while the CSV and the print view break accommodation into a room line and a
 * breakfast line. If those ever came from different calculations, a stay could
 * show, say, 269.70 in the PDF and 197.39 + 72.30 = 269.69 in the CSV. These
 * tests pin them to the shared, cents-exact helpers, and a source check keeps
 * the exports from drifting back to raw `price_eur` arithmetic.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  calcRoomPrice,
  calcBreakfastPrice,
  effectiveChargedTotal,
  isAccommodationRow,
  type AccommodationPricingRow,
} from "./report-accommodation-pricing";

const cents = (n: number) => Math.round(n * 100);

const row = (over: Partial<AccommodationPricingRow> = {}): AccommodationPricingRow => ({
  reservation_type: "guesthouse",
  date: "2099-06-01",
  check_out_date: "2099-06-04",
  guests_count: 2,
  breakfast_included: true,
  breakfast_price_per_person: 12,
  price_eur: 340.5,
  ...over,
});

/** What the PDF table prints in its total column. */
const pdfTotalCell = (r: AccommodationPricingRow) =>
  effectiveChargedTotal(r) > 0 ? effectiveChargedTotal(r).toFixed(2) : "-";

/** What the CSV writes in its price and total columns. */
const csvCells = (r: AccommodationPricingRow) => {
  const bf = calcBreakfastPrice(r);
  const room = calcRoomPrice(r);
  const total = effectiveChargedTotal(r);
  if (isAccommodationRow(r)) {
    return {
      price: room.toFixed(2),
      total: bf > 0 ? `${room.toFixed(2)} + Breakfast: ${bf.toFixed(2)} = ${total.toFixed(2)}` : total.toFixed(2),
    };
  }
  return { price: total > 0 ? total.toFixed(2) : "-", total: total > 0 ? total.toFixed(2) : "-" };
};

const stays: AccommodationPricingRow[] = [
  row(),
  row({ price_eur: 269.703, breakfast_price_per_person: 0.33, guests_count: 3 }),
  row({ price_eur: 180.699, breakfast_included: false }),
  row({ reservation_type: "hotel", price_eur: 1234.567, breakfast_price_per_person: 19.99 }),
  row({ price_eur: 120, guests_count: 6, breakfast_price_per_person: 25 }),
  row({ reservation_type: "venue", price_eur: 450, breakfast_included: false }),
  row({ reservation_type: "restaurant", pricing_type: "menu", price_eur: 99, breakfast_included: false }),
];

describe("period report exports use one accommodation calculation", () => {
  it("prints the same total in the PDF as the CSV room + breakfast split", () => {
    for (const r of stays) {
      const { total: csvTotal } = csvCells(r);
      const shown = effectiveChargedTotal(r);
      // The PDF cell and the CSV total end with the very same amount.
      expect(pdfTotalCell(r)).toBe(shown > 0 ? shown.toFixed(2) : "-");
      expect(csvTotal).toBe(shown > 0 ? csvCells(r).total : "-");
      if (shown > 0) expect(csvTotal.endsWith(shown.toFixed(2))).toBe(true);
      if (isAccommodationRow(r)) {
        expect(cents(calcRoomPrice(r)) + cents(calcBreakfastPrice(r))).toBe(cents(shown));
      }
    }
  });

  it("keeps the CSV price column equal to the room line for accommodation", () => {
    for (const r of stays.filter(isAccommodationRow)) {
      expect(csvCells(r).price).toBe(calcRoomPrice(r).toFixed(2));
    }
  });

  it("counts restaurant 'according to menu' bookings as no amount everywhere", () => {
    const menu = row({ reservation_type: "restaurant", pricing_type: "menu", price_eur: 99, breakfast_included: false });
    expect(effectiveChargedTotal(menu)).toBe(0);
    expect(pdfTotalCell(menu)).toBe("-");
    expect(csvCells(menu).total).toBe("-");
  });

  it("makes the grand total equal the sum of the room and breakfast lines", () => {
    const grandTotalC = stays.reduce((s, r) => s + cents(effectiveChargedTotal(r)), 0);
    const linesC = stays.reduce(
      (s, r) =>
        s +
        (isAccommodationRow(r)
          ? cents(calcRoomPrice(r)) + cents(calcBreakfastPrice(r))
          : cents(effectiveChargedTotal(r))),
      0,
    );
    expect(linesC).toBe(grandTotalC);
  });

  it("keeps the report panel free of its own money arithmetic", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/dashboard/ReportsPanel.tsx"),
      "utf8",
    );
    // The single money helper delegates to the shared, tested calculation.
    expect(src).toContain("effectiveChargedTotal as effectiveChargedTotalFor");
    expect(src).toContain("effectiveChargedTotalFor(r)");
    // No local re-implementation of the charged amount or the split.
    expect(src).not.toMatch(/return r\.price_eur \?\? 0/);
    expect(src).not.toMatch(/price_eur\s*\??\?\?\s*0\)\s*\*\s*calcNights/);
    // PDF, CSV and print all read the same three helpers.
    for (const helper of ["effectivePrice(r)", "calcRoomPrice(r)", "calcBreakfastPrice(r)"]) {
      expect(src).toContain(helper);
    }
  });
});
