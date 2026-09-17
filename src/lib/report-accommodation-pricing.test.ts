/**
 * Regression test: period report accommodation totals must match the amount the
 * guest is actually charged.
 *
 * A stay's `price_eur` is the total for the whole booking (room x nights, plus
 * breakfast when included). An earlier bug multiplied that stored total by the
 * number of nights again and then added breakfast on top, so a three-night stay
 * appeared at roughly three times its real value. These tests lock the split:
 *
 *   room + breakfast === price_eur   (for every accommodation row)
 */

import { describe, it, expect } from "vitest";
import {
  calcNights,
  calcRoomPrice,
  calcBreakfastPrice,
  isAccommodationRow,
  DEFAULT_BREAKFAST_PRICE_PER_PERSON,
  type AccommodationPricingRow,
} from "./report-accommodation-pricing";

const row = (o: Partial<AccommodationPricingRow>): AccommodationPricingRow => ({
  reservation_type: "guesthouse",
  date: "2099-06-01",
  check_out_date: null,
  guests_count: 2,
  breakfast_included: false,
  breakfast_price_per_person: null,
  price_eur: null,
  ...o,
});

describe("report accommodation pricing", () => {
  it("counts nights from check-in to check-out", () => {
    expect(calcNights(row({ check_out_date: "2099-06-04" }))).toBe(3);
    expect(calcNights(row({ check_out_date: null }))).toBe(1);
    // Same-day and inverted dates never drop below one night.
    expect(calcNights(row({ check_out_date: "2099-06-01" }))).toBe(1);
    expect(calcNights(row({ check_out_date: "2099-05-30" }))).toBe(1);
  });

  it("splits a multi-night stay with breakfast into room + breakfast without inflating the total", () => {
    // 3 nights, 2 guests, 89.50 per night + 12 breakfast per person per night.
    // Guest is charged 3 * 89.50 + 3 * 2 * 12 = 268.50 + 72 = 340.50.
    const stay = row({
      check_out_date: "2099-06-04",
      guests_count: 2,
      breakfast_included: true,
      breakfast_price_per_person: 12,
      price_eur: 340.5,
    });

    expect(calcBreakfastPrice(stay)).toBeCloseTo(72, 2);
    expect(calcRoomPrice(stay)).toBeCloseTo(268.5, 2);
    // The regression guard: the report lines add back up to the stored total.
    expect(calcRoomPrice(stay) + calcBreakfastPrice(stay)).toBeCloseTo(stay.price_eur!, 2);
    // And never the old inflated figure (total x nights + breakfast).
    expect(calcRoomPrice(stay)).toBeLessThan(stay.price_eur!);
  });

  it("reports the whole stored total as room revenue when breakfast is not included", () => {
    const stay = row({ check_out_date: "2099-06-06", price_eur: 447.5, breakfast_included: false });
    expect(calcBreakfastPrice(stay)).toBe(0);
    expect(calcRoomPrice(stay)).toBeCloseTo(447.5, 2);
    expect(calcRoomPrice(stay) + calcBreakfastPrice(stay)).toBeCloseTo(stay.price_eur!, 2);
  });

  it("uses the default breakfast price when the stay has none stored", () => {
    const stay = row({
      check_out_date: "2099-06-03",
      guests_count: 3,
      breakfast_included: true,
      breakfast_price_per_person: null,
      price_eur: 400,
    });
    expect(calcBreakfastPrice(stay)).toBe(DEFAULT_BREAKFAST_PRICE_PER_PERSON * 3 * 2);
    expect(calcRoomPrice(stay) + calcBreakfastPrice(stay)).toBeCloseTo(400, 2);
  });

  it("never reports negative room revenue when breakfast exceeds the stored total", () => {
    const stay = row({
      check_out_date: "2099-06-04",
      guests_count: 4,
      breakfast_included: true,
      breakfast_price_per_person: 20,
      price_eur: 100, // under-priced row; breakfast alone would be 240
    });
    expect(calcRoomPrice(stay)).toBe(0);
    expect(calcRoomPrice(stay)).toBeGreaterThanOrEqual(0);
  });

  it("treats hotels like guesthouses and leaves other services untouched", () => {
    const hotel = row({
      reservation_type: "hotel",
      check_out_date: "2099-06-03",
      guests_count: 1,
      breakfast_included: true,
      breakfast_price_per_person: 10,
      price_eur: 220,
    });
    expect(isAccommodationRow(hotel)).toBe(true);
    expect(calcBreakfastPrice(hotel)).toBe(20);
    expect(calcRoomPrice(hotel) + calcBreakfastPrice(hotel)).toBeCloseTo(220, 2);

    const venue = row({ reservation_type: "venue", breakfast_included: true, price_eur: 450 });
    expect(isAccommodationRow(venue)).toBe(false);
    expect(calcBreakfastPrice(venue)).toBe(0);
    expect(calcRoomPrice(venue)).toBe(450);
  });

  it("keeps the period accommodation total equal to the sum of guest-charged amounts", () => {
    const stays: AccommodationPricingRow[] = [
      row({
        check_out_date: "2099-06-04",
        guests_count: 2,
        breakfast_included: true,
        breakfast_price_per_person: 12,
        price_eur: 340.5,
      }),
      row({ reservation_type: "hotel", check_out_date: "2099-06-08", guests_count: 1, price_eur: 210 }),
      row({
        check_out_date: "2099-06-12",
        guests_count: 3,
        breakfast_included: true,
        breakfast_price_per_person: 15,
        price_eur: 512.75,
      }),
      row({ check_out_date: null, guests_count: 2, price_eur: 89.9 }),
    ];

    const roomRevenue = stays.reduce((s, r) => s + calcRoomPrice(r), 0);
    const breakfastRevenue = stays.reduce((s, r) => s + calcBreakfastPrice(r), 0);
    const charged = stays.reduce((s, r) => s + (r.price_eur ?? 0), 0);

    expect(roomRevenue + breakfastRevenue).toBeCloseTo(charged, 2);
    expect(charged).toBeCloseTo(340.5 + 210 + 512.75 + 89.9, 2);
    // Nights are still reported for the same set of stays.
    expect(stays.reduce((s, r) => s + calcNights(r), 0)).toBe(3 + 7 + 11 + 1);
  });
});
