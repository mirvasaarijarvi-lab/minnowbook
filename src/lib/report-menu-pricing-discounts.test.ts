import { describe, it, expect } from "vitest";
import {
  reportAmounts,
  sumReportAmounts,
  roundCents,
  type ReportPricingRow,
} from "./report-pricing-accessor";
import {
  CSV_NO_AMOUNT,
  PDF_NO_AMOUNT,
  PRINT_NO_AMOUNT,
  csvPriceCells,
  pdfPriceCells,
  printPriceCells,
} from "./report-export-cells";

/**
 * Regression: a restaurant booking priced "according to menu" has no fixed
 * amount, so reports must show no room total and no breakfast total for it,
 * even when the booking carries a promo code, a percentage or fixed discount,
 * a manually adjusted price, or a breakfast flag left on by mistake. A
 * discount must never turn "we bill by the menu" into an invented figure.
 */

const LABELS = { breakfast: "Breakfast" };
const fmtEur = (v: number) =>
  v.toLocaleString("fi-FI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

type MenuRow = ReportPricingRow & { label: string };

const menuRow = (
  label: string,
  over: Partial<ReportPricingRow> = {},
): MenuRow => ({
  label,
  reservation_type: "restaurant",
  pricing_type: "menu",
  date: "2026-12-04",
  check_out_date: null,
  guests_count: 8,
  breakfast_included: false,
  breakfast_price_per_person: null,
  price_eur: null,
  ...over,
});

/** Every shape of discount a menu-priced booking can carry. */
const DISCOUNTED_MENU_ROWS: MenuRow[] = [
  menuRow("percentage promo code", { price_eur: 240 }),
  menuRow("fixed coupon", { price_eur: 175 }),
  menuRow("deep percentage discount", { price_eur: 12.5 }),
  menuRow("fully comped", { price_eur: 0 }),
  menuRow("manual price adjustment", { price_eur: 333.33 }),
  menuRow("discount with breakfast flag left on", {
    price_eur: 199.9,
    breakfast_included: true,
    breakfast_price_per_person: 15,
  }),
  menuRow("discount and a multi-day range", {
    price_eur: 450,
    check_out_date: "2026-12-07",
    breakfast_included: true,
    breakfast_price_per_person: 21.5,
    guests_count: 20,
  }),
  menuRow("no price at all", { price_eur: null }),
];

describe("menu-priced bookings with discounts", () => {
  it("report zero charged, zero room and zero breakfast", () => {
    for (const row of DISCOUNTED_MENU_ROWS) {
      const a = reportAmounts(row);
      expect(a.charged, row.label).toBe(0);
      expect(a.room, row.label).toBe(0);
      expect(a.breakfast, row.label).toBe(0);
      expect(a.hasAmount, row.label).toBe(false);
      expect(a.isAccommodation, row.label).toBe(false);
    }
  });

  it("show a placeholder in the CSV, print view and PDF, never a discounted figure", () => {
    for (const row of DISCOUNTED_MENU_ROWS) {
      const csv = csvPriceCells(row, LABELS);
      expect(csv.price, row.label).toBe(CSV_NO_AMOUNT);
      expect(csv.total, row.label).toBe(CSV_NO_AMOUNT);

      const print = printPriceCells(row, LABELS, fmtEur);
      expect(print.price, row.label).toBe(PRINT_NO_AMOUNT);
      expect(print.total, row.label).toBe(PRINT_NO_AMOUNT);

      const pdf = pdfPriceCells(row);
      expect(pdf.room, row.label).toBe(PDF_NO_AMOUNT);
      expect(pdf.breakfast, row.label).toBe(PDF_NO_AMOUNT);
      expect(pdf.total, row.label).toBe(PDF_NO_AMOUNT);

      // The discounted amount stored on the booking never leaks into a cell.
      const stored = row.price_eur;
      if (stored) {
        for (const cell of [
          csv.price,
          csv.total,
          print.price,
          print.total,
          pdf.room,
          pdf.total,
        ]) {
          expect(
            cell.includes(stored.toFixed(2)),
            `${row.label}: ${cell}`,
          ).toBe(false);
        }
      }
    }
  });

  it("add nothing to a period's room, breakfast or charged totals", () => {
    const menuOnly = sumReportAmounts(DISCOUNTED_MENU_ROWS);
    expect(menuOnly.charged).toBe(0);
    expect(menuOnly.room).toBe(0);
    expect(menuOnly.breakfast).toBe(0);
    expect(menuOnly.count).toBe(DISCOUNTED_MENU_ROWS.length);
  });

  it("leave a mixed period's totals identical with or without them", () => {
    const realBookings: ReportPricingRow[] = [
      {
        reservation_type: "guesthouse",
        date: "2026-12-01",
        check_out_date: "2026-12-04",
        guests_count: 2,
        breakfast_included: true,
        breakfast_price_per_person: 12,
        price_eur: 222.75, // 25% promo code applied
      },
      {
        reservation_type: "hotel",
        date: "2026-12-05",
        check_out_date: "2026-12-07",
        guests_count: 2,
        breakfast_included: true,
        breakfast_price_per_person: 21.5,
        price_eur: 346, // 50 EUR coupon applied
      },
      {
        reservation_type: "restaurant",
        pricing_type: "fixed_price",
        date: "2026-12-06",
        guests_count: 12,
        breakfast_included: false,
        price_eur: 480, // discounted set menu, but a real fixed amount
      },
    ];

    const withoutMenu = sumReportAmounts(realBookings);
    const withMenu = sumReportAmounts([
      ...realBookings,
      ...DISCOUNTED_MENU_ROWS,
    ]);

    expect(withMenu.charged).toBe(withoutMenu.charged);
    expect(withMenu.room).toBe(withoutMenu.room);
    expect(withMenu.breakfast).toBe(withoutMenu.breakfast);
    expect(withMenu.count).toBe(
      realBookings.length + DISCOUNTED_MENU_ROWS.length,
    );
    // The period still balances: room + breakfast equals the charged total.
    expect(roundCents(withMenu.room + withMenu.breakfast)).toBe(
      withMenu.charged,
    );
    expect(withMenu.charged).toBe(roundCents(222.75 + 346 + 480));
  });

  it("still count a discounted restaurant booking that has a real fixed price", () => {
    // Guard against over-zeroing: only pricing_type "menu" is amount-free.
    const fixed = reportAmounts({
      reservation_type: "restaurant",
      pricing_type: "fixed_price",
      date: "2026-12-06",
      guests_count: 10,
      breakfast_included: false,
      price_eur: 420,
    });
    expect(fixed.charged).toBe(420);
    expect(fixed.room).toBe(420);
    expect(fixed.breakfast).toBe(0);
    expect(fixed.hasAmount).toBe(true);

    const quote = reportAmounts({
      reservation_type: "restaurant",
      pricing_type: "quote",
      date: "2026-12-06",
      guests_count: 10,
      breakfast_included: false,
      price_eur: 250,
    });
    expect(quote.charged).toBe(250);

    // A menu-priced booking of another service type keeps its amount as well:
    // the exemption is restaurant-specific.
    const venueMenu = reportAmounts({
      reservation_type: "venue",
      pricing_type: "menu",
      date: "2026-12-06",
      guests_count: 40,
      breakfast_included: false,
      price_eur: 900,
    });
    expect(venueMenu.charged).toBe(900);
  });
});
