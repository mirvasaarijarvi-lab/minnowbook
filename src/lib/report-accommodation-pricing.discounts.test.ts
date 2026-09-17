/**
 * Regression: discounted, coupon-priced and manually adjusted multi-night stays.
 *
 * A discounted stay stores two amounts: `original_price_eur` (the list price
 * before the discount) and `price_eur` (what the guest actually pays). Reports
 * must always split the amount the guest pays, never the list price, otherwise
 * a promo-code stay would show more revenue than was ever charged, and the room
 * line plus the breakfast line would no longer add up to the total.
 */

import { describe, it, expect } from "vitest";
import {
  calcRoomPrice,
  calcBreakfastPrice,
  calcNights,
  effectiveChargedTotal,
  DEFAULT_BREAKFAST_PRICE_PER_PERSON,
  type AccommodationPricingRow,
} from "./report-accommodation-pricing";

interface DiscountRow extends AccommodationPricingRow {
  original_price_eur?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
  discount_reason?: string | null;
}

const cents = (n: number) => Math.round(n * 100);

/** Room + breakfast must equal the charged total, to the cent. */
const expectSplitMatches = (r: DiscountRow) => {
  const total = effectiveChargedTotal(r);
  expect(cents(calcRoomPrice(r)) + cents(calcBreakfastPrice(r))).toBe(cents(total));
  expect(calcRoomPrice(r)).toBeGreaterThanOrEqual(0);
  expect(calcBreakfastPrice(r)).toBeGreaterThanOrEqual(0);
  return total;
};

const stay = (over: Partial<DiscountRow> = {}): DiscountRow => ({
  reservation_type: "guesthouse",
  date: "2099-06-01",
  check_out_date: "2099-06-04", // 3 nights
  guests_count: 2,
  breakfast_included: true,
  breakfast_price_per_person: 12,
  price_eur: 297,
  ...over,
});

describe("accommodation totals with discounts, coupons and manual adjustments", () => {
  it("splits the discounted amount, not the list price (percentage promo code)", () => {
    // 3 nights x 75 + breakfast 12 x 2 x 3 = 297 list, 25% code -> 222.75 charged.
    const r = stay({
      price_eur: 222.75,
      original_price_eur: 297,
      discount_type: "percentage",
      discount_value: 25,
      discount_reason: "Promo code: SUMMER25",
    });
    const total = expectSplitMatches(r);
    expect(total).toBe(222.75);
    expect(calcBreakfastPrice(r)).toBe(72); // 12 x 2 guests x 3 nights
    expect(calcRoomPrice(r)).toBe(150.75); // charged total minus breakfast
    // Never the list price.
    expect(calcRoomPrice(r) + calcBreakfastPrice(r)).not.toBe(297);
  });

  it("splits a fixed-amount coupon stay to the cent", () => {
    const r = stay({
      price_eur: 247,
      original_price_eur: 297,
      discount_type: "fixed",
      discount_value: 50,
      discount_reason: "Promo code: WELCOME50",
    });
    expect(expectSplitMatches(r)).toBe(247);
    expect(calcRoomPrice(r)).toBe(175);
  });

  it("handles awkward percentages that land on fractions of a cent", () => {
    // 269.70 x 0.67 = 180.699 -> 180.70 charged.
    const r = stay({
      check_out_date: "2099-06-04",
      breakfast_price_per_person: 0.33,
      guests_count: 3,
      price_eur: 180.699,
      original_price_eur: 269.7,
      discount_type: "percentage",
      discount_value: 33,
    });
    expect(expectSplitMatches(r)).toBe(180.7);
  });

  it("keeps long discounted stays and large groups exact", () => {
    for (const nights of [1, 2, 7, 14, 30, 120, 365]) {
      for (const guests of [1, 2, 5, 17, 250]) {
        const checkIn = new Date(Date.UTC(2099, 0, 1));
        const checkOut = new Date(checkIn.getTime() + nights * 86400000);
        const r = stay({
          date: checkIn.toISOString().slice(0, 10),
          check_out_date: checkOut.toISOString().slice(0, 10),
          guests_count: guests,
          breakfast_price_per_person: 8.95,
          price_eur: Math.round(nights * guests * 33.333 * 0.85 * 100) / 100,
          original_price_eur: Math.round(nights * guests * 33.333 * 100) / 100,
          discount_type: "percentage",
          discount_value: 15,
        });
        expect(calcNights(r)).toBe(nights);
        expectSplitMatches(r);
      }
    }
  });

  it("caps breakfast when a deep discount drops the total below the breakfast value", () => {
    const r = stay({
      price_eur: 40,
      original_price_eur: 297,
      discount_type: "percentage",
      discount_value: 86,
    });
    expect(expectSplitMatches(r)).toBe(40);
    expect(calcBreakfastPrice(r)).toBe(40); // capped at the charged amount
    expect(calcRoomPrice(r)).toBe(0); // room line never negative
  });

  it("counts a fully comped stay as zero with no negative lines", () => {
    for (const price of [0, null]) {
      const r = stay({
        price_eur: price,
        original_price_eur: 297,
        discount_type: "percentage",
        discount_value: 100,
        discount_reason: "Comped",
      });
      expect(expectSplitMatches(r)).toBe(0);
      expect(calcRoomPrice(r)).toBe(0);
      expect(calcBreakfastPrice(r)).toBe(0);
    }
  });

  it("follows a manual price adjustment, up or down", () => {
    const down = stay({ price_eur: 210, original_price_eur: 297, discount_reason: "Manual adjustment" });
    expect(expectSplitMatches(down)).toBe(210);
    expect(calcRoomPrice(down)).toBe(138);

    // Staff may also raise the price (late checkout, extra bed).
    const up = stay({ price_eur: 355.5, original_price_eur: 297 });
    expect(expectSplitMatches(up)).toBe(355.5);
    expect(calcRoomPrice(up)).toBe(283.5);
  });

  it("uses the saved breakfast rate on discounted stays, falling back to the default", () => {
    const saved = stay({ price_eur: 222.75, original_price_eur: 297, breakfast_price_per_person: 12 });
    expect(calcBreakfastPrice(saved)).toBe(72);

    const noRate = stay({
      price_eur: 222.75,
      original_price_eur: 297,
      breakfast_price_per_person: null,
    });
    expect(calcBreakfastPrice(noRate)).toBe(DEFAULT_BREAKFAST_PRICE_PER_PERSON * 2 * 3);
    expectSplitMatches(noRate);

    const noBreakfast = stay({ breakfast_included: false, price_eur: 168.75, original_price_eur: 225 });
    expect(calcBreakfastPrice(noBreakfast)).toBe(0);
    expect(calcRoomPrice(noBreakfast)).toBe(168.75);
  });

  it("makes the period total equal the sum of charged amounts, and the discount saving the difference from list prices", () => {
    const rows: DiscountRow[] = [
      stay({ price_eur: 222.75, original_price_eur: 297, discount_type: "percentage", discount_value: 25 }),
      stay({ price_eur: 247, original_price_eur: 297, discount_type: "fixed", discount_value: 50 }),
      stay({ price_eur: 297 }), // no discount
      stay({ reservation_type: "hotel", price_eur: 89.9, original_price_eur: 129.9, breakfast_price_per_person: 19.99 }),
      stay({ price_eur: 0, original_price_eur: 297, discount_type: "percentage", discount_value: 100 }),
    ];

    const chargedC = rows.reduce((s, r) => s + cents(effectiveChargedTotal(r)), 0);
    const linesC = rows.reduce((s, r) => s + cents(calcRoomPrice(r)) + cents(calcBreakfastPrice(r)), 0);
    expect(linesC).toBe(chargedC);

    const listC = rows.reduce((s, r) => s + cents(r.original_price_eur ?? r.price_eur ?? 0), 0);
    expect(listC - chargedC).toBe(cents(74.25 + 50 + 40 + 297));
  });
});
