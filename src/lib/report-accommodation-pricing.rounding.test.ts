/**
 * Edge-case regression: the room + breakfast split must never differ from the
 * charged amount by even a single cent.
 *
 * Money in JavaScript is binary floating point, so 0.1 * 3 is 0.30000000000000004
 * and 269.70 - 72.30 is 197.39999999999998. If reports subtracted raw values,
 * a period total could end up a cent (or a fraction of one) off the sum of what
 * guests actually paid, which staff then chase against their invoices. These
 * tests lock exact cent equality across awkward rates, long stays, large
 * groups and impossible configurations (breakfast priced above the total).
 */

import { describe, it, expect } from "vitest";
import {
  calcRoomPrice,
  calcBreakfastPrice,
  calcChargedTotal,
  roundCents,
  type AccommodationPricingRow,
} from "./report-accommodation-pricing";

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

/** In cents, so the assertion cannot itself hide a sub-cent drift. */
const cents = (n: number) => Math.round(n * 100);

const expectExactSplit = (r: AccommodationPricingRow) => {
  const roomC = cents(calcRoomPrice(r));
  const bfC = cents(calcBreakfastPrice(r));
  const totalC = cents(calcChargedTotal(r));
  expect(roomC + bfC).toBe(totalC);
  expect(roomC).toBeGreaterThanOrEqual(0);
  expect(bfC).toBeGreaterThanOrEqual(0);
  // Each line is a whole number of cents, never a fraction of one.
  expect(calcRoomPrice(r) * 100).toBeCloseTo(roomC, 9);
  expect(calcBreakfastPrice(r) * 100).toBeCloseTo(bfC, 9);
};

describe("report accommodation split, rounding edge cases", () => {
  it("snaps values to whole cents", () => {
    expect(roundCents(0.1 * 3)).toBe(0.3);
    expect(roundCents(197.39999999999998)).toBe(197.4);
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(180.699)).toBe(180.7);
    expect(roundCents(Number.NaN)).toBe(0);
    expect(calcChargedTotal({ price_eur: 269.7049 })).toBe(269.7);
    expect(calcChargedTotal({ price_eur: null })).toBe(0);
  });

  it("splits awkward breakfast rates without a cent of drift", () => {
    const rates = [0.1, 0.33, 1.005, 3.333, 7.77, 8.95, 11.11, 12.345, 15, 19.99];
    for (const rate of rates) {
      expectExactSplit(row({ breakfast_price_per_person: rate, price_eur: 340.5 }));
      expectExactSplit(row({ breakfast_price_per_person: rate, price_eur: 269.703 }));
    }
  });

  it("splits awkward totals without a cent of drift", () => {
    const totals = [0, 0.01, 0.99, 89.9, 180.699, 197.39999999999998, 269.7, 1234.567, 99999.995];
    for (const total of totals) {
      expectExactSplit(row({ price_eur: total }));
      expectExactSplit(row({ price_eur: total, breakfast_included: false }));
    }
  });

  it("holds for long stays and large groups", () => {
    for (const nights of [1, 2, 7, 13, 29, 90, 365]) {
      const checkOut = new Date(Date.UTC(2099, 5, 1) + nights * 86400000)
        .toISOString()
        .slice(0, 10);
      for (const guests of [1, 3, 7, 11, 47, 250]) {
        expectExactSplit(
          row({
            check_out_date: checkOut,
            guests_count: guests,
            breakfast_price_per_person: 8.95,
            price_eur: roundCents(59.9 * nights + 8.95 * guests * nights),
          }),
        );
      }
    }
  });

  it("keeps the split exact when breakfast alone would exceed the charged total", () => {
    const r = row({ guests_count: 6, breakfast_price_per_person: 25, price_eur: 120 });
    expectExactSplit(r);
    // Breakfast is capped at the total, so the room line is 0 and nothing is lost.
    expect(calcBreakfastPrice(r)).toBe(120);
    expect(calcRoomPrice(r)).toBe(0);
  });

  it("keeps the split exact for zero-priced and comped stays", () => {
    expectExactSplit(row({ price_eur: 0 }));
    expectExactSplit(row({ price_eur: null }));
    expectExactSplit(row({ price_eur: 0, breakfast_price_per_person: 0 }));
    expectExactSplit(row({ price_eur: 12, breakfast_price_per_person: 0 }));
  });

  it("keeps a whole period's room and breakfast lines equal to the charged sum, to the cent", () => {
    const stays: AccommodationPricingRow[] = [
      row({ price_eur: 340.5, breakfast_price_per_person: 12 }),
      row({ price_eur: 269.703, breakfast_price_per_person: 0.33, guests_count: 3 }),
      row({ price_eur: 89.9, check_out_date: null, breakfast_included: false }),
      row({ reservation_type: "hotel", price_eur: 1234.567, breakfast_price_per_person: 19.99 }),
      row({ price_eur: 120, guests_count: 6, breakfast_price_per_person: 25 }),
      row({ price_eur: 0.01, breakfast_price_per_person: 15 }),
    ];

    const roomC = stays.reduce((s, r) => s + cents(calcRoomPrice(r)), 0);
    const bfC = stays.reduce((s, r) => s + cents(calcBreakfastPrice(r)), 0);
    const chargedC = stays.reduce((s, r) => s + cents(calcChargedTotal(r)), 0);

    expect(roomC + bfC).toBe(chargedC);
  });
});
