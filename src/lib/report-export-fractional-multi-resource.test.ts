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
  parseCsvSplitCell,
  pdfPriceCells,
  printPriceCells,
} from "./report-export-cells";

/**
 * Regression: fractional pricing and discounts spread over several resources.
 *
 * A stay is rarely one clean row against one room. A group takes two room types
 * at different nightly and breakfast rates, a long stay moves from a hotel room
 * to a guesthouse room mid-week, and a promo code or coupon lands on some legs
 * only. All of those produce awkward fractions of a cent. This test reads the
 * exported cells back the way a spreadsheet, a printed page and the report PDF
 * present them, and confirms rounding never makes an export total differ from
 * the amount the guest is charged: per row the room cell plus the breakfast cell
 * equals the total cell, and the period total equals the sum of the printed
 * totals, to the cent.
 */

const LABELS = { breakfast: "Breakfast" };
const fmtEur = (v: number) => `${v.toFixed(2)} EUR`;

type Row = ReportPricingRow & { label: string };

const nightsLater = (start: string, nights: number) =>
  new Date(new Date(start + "T00:00:00Z").getTime() + nights * 86400000)
    .toISOString()
    .slice(0, 10);

interface LegSpec {
  label: string;
  type?: string;
  nightly: number;
  nights: number;
  guests: number;
  breakfastRate?: number | null;
  breakfast?: boolean;
  /** Percentage discount on the gross total, e.g. 12.345. */
  percent?: number;
  /** Fixed coupon in EUR off the gross total. */
  coupon?: number;
  /** Staff override of the charged amount. */
  override?: number;
  pricing_type?: string | null;
  start?: string;
}

/** Build a row the way the booking function stores it: gross list price plus the charged amount. */
const leg = (spec: LegSpec): Row => {
  const start = spec.start ?? "2026-09-01";
  const guests = spec.guests;
  const breakfast = spec.breakfast ?? true;
  const rate = spec.breakfastRate === undefined ? 11.35 : spec.breakfastRate;
  const gross = roundCents(
    spec.nightly * spec.nights + (breakfast && rate ? rate * guests * spec.nights : 0),
  );
  let charged = gross;
  if (spec.percent !== undefined) charged = roundCents(gross * (1 - spec.percent / 100));
  if (spec.coupon !== undefined) charged = roundCents(Math.max(0, charged - spec.coupon));
  if (spec.override !== undefined) charged = roundCents(spec.override);
  return {
    label: spec.label,
    reservation_type: spec.type ?? "guesthouse",
    date: start,
    check_out_date: nightsLater(start, spec.nights),
    guests_count: guests,
    breakfast_included: breakfast,
    breakfast_price_per_person: rate,
    original_price_eur: gross,
    price_eur: charged,
    pricing_type: spec.pricing_type ?? null,
  } as Row;
};

/** Read every export surface back and check it reconciles with the charged amount. */
const checkExports = (rows: Row[]) => {
  let csvTotalCents = 0;
  let printTotalCents = 0;
  let pdfTotalCents = 0;

  for (const r of rows) {
    const a = reportAmounts(r);
    // The accessor itself: the two lines are the charged amount.
    expect(roundCents(a.room + a.breakfast), `accessor split ${r.label}`).toBe(
      roundCents(a.charged),
    );

    const csv = csvPriceCells(r, LABELS);
    const print = printPriceCells(r, LABELS, fmtEur);
    const pdf = pdfPriceCells(r);

    if (!a.hasAmount) {
      expect(csv.total, `csv placeholder ${r.label}`).toBe(CSV_NO_AMOUNT);
      expect(csv.price).toBe(CSV_NO_AMOUNT);
      expect(print.total, `print placeholder ${r.label}`).toBe(PRINT_NO_AMOUNT);
      expect(pdf.total, `pdf placeholder ${r.label}`).toBe(PDF_NO_AMOUNT);
      expect(pdf.room).toBe(PDF_NO_AMOUNT);
      expect(pdf.breakfast).toBe(PDF_NO_AMOUNT);
      continue;
    }

    // CSV: parse the split cell back the way a spreadsheet reader would.
    const split = parseCsvSplitCell(csv.total);
    if (split) {
      expect(roundCents(split.room + split.breakfast), `csv split ${r.label}`).toBe(split.total);
      expect(split.total, `csv total ${r.label}`).toBe(roundCents(a.charged));
      expect(Number(csv.price), `csv price cell ${r.label}`).toBe(split.room);
      csvTotalCents += Math.round(split.total * 100);
    } else {
      expect(Number(csv.total), `csv plain total ${r.label}`).toBe(roundCents(a.charged));
      csvTotalCents += Math.round(Number(csv.total) * 100);
    }

    // PDF: three money columns, room + breakfast === total.
    const pdfRoom = Number(pdf.room);
    const pdfBreakfast = pdf.breakfast === PDF_NO_AMOUNT ? 0 : Number(pdf.breakfast);
    const pdfTotal = Number(pdf.total);
    expect(roundCents(pdfRoom + pdfBreakfast), `pdf split ${r.label}`).toBe(pdfTotal);
    expect(pdfTotal, `pdf total ${r.label}`).toBe(roundCents(a.charged));
    pdfTotalCents += Math.round(pdfTotal * 100);

    // Print view: strip the markup and read the figures back.
    const printNumbers = print.total.replace(/<[^>]*>/g, " ").match(/-?\d+\.\d{2}/g) ?? [];
    const printTotal = Number(printNumbers[printNumbers.length - 1]);
    expect(printTotal, `print total ${r.label}`).toBe(roundCents(a.charged));
    if (printNumbers.length === 3) {
      expect(roundCents(Number(printNumbers[0]) + Number(printNumbers[1])), `print split ${r.label}`)
        .toBe(printTotal);
    }
    printTotalCents += Math.round(printTotal * 100);
  }

  const totals = sumReportAmounts(rows);
  expect(roundCents(csvTotalCents / 100), "csv period total").toBe(totals.charged);
  expect(roundCents(pdfTotalCents / 100), "pdf period total").toBe(totals.charged);
  expect(roundCents(printTotalCents / 100), "print period total").toBe(totals.charged);
  expect(roundCents(totals.room + totals.breakfast), "period split").toBe(totals.charged);
  return totals;
};

describe("fractional pricing and discounts across several resources", () => {
  it("keeps a two-room group booking exact in every export", () => {
    const rows = [
      leg({
        label: "superior room, 12.345% code",
        nightly: 133.33,
        nights: 3,
        guests: 2,
        breakfastRate: 9.95,
        percent: 12.345,
      }),
      leg({
        label: "standard room, 33 EUR coupon",
        nightly: 87.77,
        nights: 3,
        guests: 3,
        breakfastRate: 7.35,
        coupon: 33,
      }),
    ];
    const totals = checkExports(rows);
    expect(totals.count).toBe(2);
    expect(totals.charged).toBeGreaterThan(0);
  });

  it("reconciles a stay that moves between a hotel and a guesthouse room", () => {
    const rows = [
      leg({
        label: "hotel leg",
        type: "hotel",
        nightly: 149.99,
        nights: 2,
        guests: 2,
        breakfastRate: 16.66,
        percent: 7.77,
        start: "2026-09-10",
      }),
      leg({
        label: "guesthouse leg",
        nightly: 96.66,
        nights: 5,
        guests: 2,
        breakfastRate: 11.11,
        percent: 7.77,
        start: "2026-09-12",
      }),
    ];
    checkExports(rows);
  });

  it("handles a package where one leg carries the whole discounted price", () => {
    const rows = [
      leg({
        label: "package leg with the price",
        nightly: 111.11,
        nights: 4,
        guests: 3,
        breakfastRate: 13.33,
        percent: 18.5,
      }),
      leg({
        label: "package leg without a price",
        nightly: 0,
        nights: 4,
        guests: 3,
        breakfastRate: 13.33,
        override: 0,
      }),
      leg({
        label: "menu-priced dinner in the same package",
        type: "restaurant",
        nightly: 0,
        nights: 1,
        guests: 6,
        breakfast: false,
        breakfastRate: null,
        pricing_type: "menu",
        override: 240.55,
      }),
    ];
    const totals = checkExports(rows);
    // The unpriced leg and the menu-priced dinner add nothing.
    expect(totals.count).toBe(3);
  });

  it("caps breakfast without a negative room line when a deep discount hits one resource", () => {
    const rows = [
      leg({
        label: "deeply discounted suite",
        nightly: 200.05,
        nights: 3,
        guests: 6,
        breakfastRate: 18.75,
        percent: 93.5,
      }),
      leg({
        label: "full price twin",
        nightly: 77.77,
        nights: 3,
        guests: 2,
        breakfastRate: 8.85,
      }),
    ];
    for (const r of rows) expect(reportAmounts(r).room).toBeGreaterThanOrEqual(0);
    checkExports(rows);
  });

  it("reconciles mixed stored and missing breakfast rates across resources", () => {
    const rows = [
      leg({ label: "stored rate", nightly: 101.01, nights: 3, guests: 2, breakfastRate: 12.55 }),
      leg({ label: "no rate saved", nightly: 101.01, nights: 3, guests: 2, breakfastRate: null }),
      leg({
        label: "no breakfast taken",
        nightly: 101.01,
        nights: 3,
        guests: 2,
        breakfast: false,
        breakfastRate: 12.55,
        percent: 5.55,
      }),
    ];
    checkExports(rows);
  });

  it("reconciles a large generated period of fractional multi-resource stays", () => {
    // Deterministic pseudo-random sweep so a failure is reproducible.
    let seed = 987654321;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

    const rows: Row[] = [];
    for (let i = 0; i < 900; i++) {
      const percent = pick([undefined, 0, 0.01, 5.5, 12.345, 33.333, 66.667, 93.5, 100]);
      const coupon = pick([undefined, undefined, 0.01, 12.34, 50, 333.33]);
      rows.push(
        leg({
          label: `generated ${i}`,
          type: pick(["guesthouse", "hotel", "guesthouse", "hotel"]),
          nightly: roundCents(37 + rnd() * 320 + rnd()),
          nights: 1 + Math.floor(rnd() * 21),
          guests: 1 + Math.floor(rnd() * 12),
          breakfastRate: pick([null, 6.67, 8.85, 11.35, 13.33, 16.66, 19.99, 0]),
          breakfast: rnd() > 0.2,
          percent: percent as number | undefined,
          coupon: coupon as number | undefined,
          override: rnd() > 0.93 ? roundCents(rnd() * 900) : undefined,
          start: `2026-0${1 + Math.floor(rnd() * 8)}-1${Math.floor(rnd() * 9)}`,
        }),
      );
    }
    const totals = checkExports(rows);
    expect(totals.count).toBe(900);
    expect(totals.charged).toBeGreaterThan(0);
  });
});
