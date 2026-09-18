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
  csvPriceCells,
  parseCsvSplitCell,
  pdfPriceCells,
} from "./report-export-cells";

/**
 * Property-based regression: thousands of randomly generated bookings, each
 * with a randomly chosen discount shape (percentage promo code, fixed coupon,
 * manual adjustment up or down, comped, none), must always satisfy
 *
 *     room line + breakfast line === charged amount   (to the cent)
 *
 * The generator is seeded, so a failure is reproducible: the seed and the
 * offending booking are printed with the assertion.
 */

/** Deterministic PRNG (mulberry32) so runs are reproducible from a seed. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const DEFAULT_SEED = 20261217;
const CASES = 20000;

type DiscountKind =
  | "none"
  | "percentage"
  | "fixed"
  | "manual_down"
  | "manual_up"
  | "comped"
  | "over_discount";

interface GeneratedCase {
  seed: number;
  index: number;
  kind: DiscountKind;
  listPrice: number;
  row: ReportPricingRow;
}

const RESERVATION_TYPES = [
  "guesthouse",
  "hotel",
  "venue",
  "restaurant",
  "wellness",
] as const;

const generate = (
  rand: () => number,
  seed: number,
  index: number,
): GeneratedCase => {
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (min: number, max: number, decimals = 2) => {
    const v = min + rand() * (max - min);
    return Number(v.toFixed(decimals));
  };

  const reservationType = pick(RESERVATION_TYPES);
  const nights = 1 + Math.floor(rand() * 400);
  const guests = 1 + Math.floor(rand() * 250);
  const nightly = between(0, 900);
  // Breakfast rate: sometimes missing, sometimes zero, sometimes odd cents.
  const rateRoll = rand();
  const breakfastRate =
    rateRoll < 0.15
      ? null
      : rateRoll < 0.2
        ? 0
        : between(0.01, 45, rand() < 0.3 ? 3 : 2);
  const breakfastIncluded = rand() < 0.75;
  const pricingType =
    reservationType === "restaurant"
      ? pick(["menu", "fixed_price", "quote", null] as const)
      : rand() < 0.1
        ? pick(["fixed_price", "quote"] as const)
        : null;

  const effectiveRate = breakfastIncluded ? (breakfastRate ?? 15) : 0;
  const listPrice = roundCents(
    nightly * nights + effectiveRate * guests * nights,
  );

  const kind = pick([
    "none",
    "percentage",
    "fixed",
    "manual_down",
    "manual_up",
    "comped",
    "over_discount",
  ] as const);

  let charged: number | null;
  switch (kind) {
    case "none":
      charged = listPrice;
      break;
    case "percentage":
      charged = roundCents(listPrice * (1 - between(0.01, 0.99, 4)));
      break;
    case "fixed":
      charged = roundCents(Math.max(0, listPrice - between(0, listPrice, 2)));
      break;
    case "manual_down":
      charged = roundCents(listPrice * between(0.05, 0.95, 4));
      break;
    case "manual_up":
      charged = roundCents(listPrice * between(1.01, 2.5, 4));
      break;
    case "comped":
      charged = 0;
      break;
    case "over_discount":
      // A pathological payload: "discounted" below zero, or no price stored.
      charged = rand() < 0.5 ? null : roundCents(-between(0, 500));
      break;
  }

  const checkOut = new Date(Date.UTC(2027, 0, 1) + nights * 86400000)
    .toISOString()
    .slice(0, 10);

  return {
    seed,
    index,
    kind,
    listPrice,
    row: {
      reservation_type: reservationType,
      pricing_type: pricingType,
      date: "2027-01-01",
      check_out_date: rand() < 0.05 ? null : checkOut,
      guests_count: guests,
      breakfast_included: breakfastIncluded,
      breakfast_price_per_person: breakfastRate,
      price_eur: charged,
    },
  };
};

const describeCase = (c: GeneratedCase) =>
  `seed=${c.seed} case=${c.index} kind=${c.kind} list=${c.listPrice} row=${JSON.stringify(c.row)}`;

describe("property: accommodation lines always sum to the charged total", () => {
  it(`holds for ${CASES} randomly generated discount combinations`, () => {
    const seed = Number(process.env.REPORT_PROPERTY_SEED ?? DEFAULT_SEED);
    const rand = rng(seed);

    let roomCents = 0;
    let breakfastCents = 0;
    let chargedCents = 0;
    const kindsSeen = new Set<DiscountKind>();

    for (let i = 0; i < CASES; i++) {
      const c = generate(rand, seed, i);
      const why = describeCase(c);
      const a = reportAmounts(c.row);
      kindsSeen.add(c.kind);

      // The core invariant, in integer cents.
      expect(
        Math.round(a.room * 100) + Math.round(a.breakfast * 100),
        why,
      ).toBe(Math.round(a.charged * 100));
      // No negative or non-finite money ever reaches a report.
      for (const v of [a.charged, a.room, a.breakfast]) {
        expect(Number.isFinite(v), why).toBe(true);
        expect(v >= 0, why).toBe(true);
        // Already snapped to whole cents.
        expect(roundCents(v), why).toBe(v);
      }
      // Neither line may exceed the amount the guest is charged.
      expect(a.room <= a.charged, why).toBe(true);
      expect(a.breakfast <= a.charged, why).toBe(true);
      // Breakfast only ever appears on accommodation bookings with breakfast.
      if (a.breakfast > 0) {
        expect(a.isAccommodation, why).toBe(true);
        expect(Boolean(c.row.breakfast_included), why).toBe(true);
      }

      roomCents += Math.round(a.room * 100);
      breakfastCents += Math.round(a.breakfast * 100);
      chargedCents += Math.round(a.charged * 100);
    }

    // Every discount shape was actually exercised.
    expect(kindsSeen.size).toBe(7);
    // The period total matches the rows it is built from, to the cent.
    expect(roomCents + breakfastCents).toBe(chargedCents);
  });

  it("exports the same balanced figures for every generated booking", () => {
    const seed = Number(process.env.REPORT_PROPERTY_SEED ?? DEFAULT_SEED) + 1;
    const rand = rng(seed);
    const rows: ReportPricingRow[] = [];

    for (let i = 0; i < 2000; i++) {
      const c = generate(rand, seed, i);
      const why = describeCase(c);
      const a = reportAmounts(c.row);
      rows.push(c.row);

      const csv = csvPriceCells(c.row, { breakfast: "Breakfast" });
      const pdf = pdfPriceCells(c.row);
      const split = parseCsvSplitCell(csv.total);

      if (!a.hasAmount) {
        expect(csv.total, why).toBe(CSV_NO_AMOUNT);
        expect(pdf.total, why).toBe(PDF_NO_AMOUNT);
        continue;
      }

      // The PDF's three money columns add up.
      const pdfRoom = Number(pdf.room);
      const pdfBreakfast =
        pdf.breakfast === PDF_NO_AMOUNT ? 0 : Number(pdf.breakfast);
      const pdfTotal = Number(pdf.total);
      expect(
        Math.round(pdfRoom * 100) + Math.round(pdfBreakfast * 100),
        why,
      ).toBe(Math.round(pdfTotal * 100));
      expect(pdfTotal, why).toBeCloseTo(a.charged, 10);

      // The CSV split, when spelled out, adds up to the same amount.
      if (split) {
        expect(
          Math.round(split.room * 100) + Math.round(split.breakfast * 100),
          why,
        ).toBe(Math.round(split.total * 100));
        expect(split.total, why).toBeCloseTo(a.charged, 10);
      } else {
        expect(Number(csv.total), why).toBeCloseTo(a.charged, 10);
      }
    }

    const totals = sumReportAmounts(rows);
    expect(roundCents(totals.room + totals.breakfast)).toBe(totals.charged);
  });
});
