import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_BREAKFAST_PRICE_PER_PERSON,
  calcBreakfastPrice,
  calcChargedTotal,
  calcNights,
  calcRoomPrice,
  effectiveChargedTotal,
  roundCents,
  type AccommodationPricingRow,
} from "./report-accommodation-pricing";

/**
 * Regression: period reports must always split multi-night stays using the
 * breakfast rate stored on the booking, which the server copies from the
 * resource, never a rate a guest's browser tried to inject and never the
 * 15 EUR fallback when a real rate exists.
 *
 * A tampered client can send breakfast_price_per_person = 0, a negative
 * number, a huge number, a string or NaN. The public booking function
 * persists only the resource's own rate (finite and >= 0), so the stored row
 * a report reads can never carry the injected value. These tests lock both
 * halves: the report arithmetic honours the stored rate, and the booking
 * function still persists the resource rate rather than the request body.
 */

const NIGHTS = 3;
const GUESTS = 2;

const stay = (
  over: Partial<AccommodationPricingRow> = {},
): AccommodationPricingRow => ({
  reservation_type: "guesthouse",
  date: "2026-06-01",
  check_out_date: "2026-06-04", // 3 nights
  guests_count: GUESTS,
  breakfast_included: true,
  breakfast_price_per_person: 12,
  price_eur: 297, // 3 x 75 room + 12 x 2 x 3 breakfast
  ...over,
});

describe("stored breakfast rates in period reports", () => {
  it("uses the stored rate, not the 15 EUR default, for a multi-night stay", () => {
    const row = stay();
    expect(calcNights(row)).toBe(NIGHTS);
    // 12 x 2 guests x 3 nights = 72, not 15 x 2 x 3 = 90.
    expect(calcBreakfastPrice(row)).toBe(72);
    expect(calcBreakfastPrice(row)).not.toBe(
      DEFAULT_BREAKFAST_PRICE_PER_PERSON * GUESTS * NIGHTS,
    );
    expect(calcRoomPrice(row)).toBe(225);
    expect(roundCents(calcRoomPrice(row) + calcBreakfastPrice(row))).toBe(
      calcChargedTotal(row),
    );
  });

  it("falls back to the default only when no rate was stored", () => {
    const row = stay({ breakfast_price_per_person: null, price_eur: 315 });
    expect(calcBreakfastPrice(row)).toBe(
      DEFAULT_BREAKFAST_PRICE_PER_PERSON * GUESTS * NIGHTS,
    );
    expect(calcRoomPrice(row)).toBe(225);
  });

  it("keeps the split exact for every plausible stored rate, stay length and party size", () => {
    const rates = [0.5, 1, 7.5, 8.95, 11.11, 12, 12.345, 15, 19.99, 24.5];
    const nights = [1, 2, 3, 7, 14, 30, 120];
    const parties = [1, 2, 4, 9, 30];
    for (const rate of rates) {
      for (const n of nights) {
        for (const guests of parties) {
          const checkOut = new Date(Date.UTC(2026, 5, 1) + n * 86400000)
            .toISOString()
            .slice(0, 10);
          const charged = roundCents(75 * n + rate * guests * n);
          const row = stay({
            check_out_date: checkOut,
            guests_count: guests,
            breakfast_price_per_person: rate,
            price_eur: charged,
          });
          expect(calcNights(row)).toBe(n);
          expect(roundCents(calcRoomPrice(row) + calcBreakfastPrice(row))).toBe(
            calcChargedTotal(row),
          );
          // The stored rate drives the breakfast line whenever it fits.
          expect(calcBreakfastPrice(row)).toBe(
            Math.min(roundCents(rate * guests * n), calcChargedTotal(row)),
          );
        }
      }
    }
  });

  it("ignores injected rates: a stored 0 rate yields no breakfast line", () => {
    // A tampered request sending breakfast_price_per_person: 0 is never
    // persisted, but if a row ever carried 0 the split must still balance
    // instead of silently charging the 15 EUR default.
    const row = stay({ breakfast_price_per_person: 0 });
    expect(calcBreakfastPrice(row)).toBe(0);
    expect(calcRoomPrice(row)).toBe(297);
    expect(roundCents(calcRoomPrice(row) + calcBreakfastPrice(row))).toBe(297);
  });

  it("never lets a negative, NaN or absurd stored rate distort the report", () => {
    const negative = stay({ breakfast_price_per_person: -50 });
    expect(calcBreakfastPrice(negative)).toBe(0);
    expect(calcRoomPrice(negative)).toBe(297);

    const nan = stay({ breakfast_price_per_person: Number.NaN });
    expect(calcBreakfastPrice(nan)).toBe(0);
    expect(calcRoomPrice(nan)).toBe(297);

    const absurd = stay({ breakfast_price_per_person: 100_000 });
    // Breakfast is capped at the charged total; the room line stays >= 0 and
    // the split still adds up to what the guest pays.
    expect(calcBreakfastPrice(absurd)).toBe(297);
    expect(calcRoomPrice(absurd)).toBe(0);
    expect(roundCents(calcRoomPrice(absurd) + calcBreakfastPrice(absurd))).toBe(
      297,
    );
  });

  it("applies stored rates identically for hotels and leaves other types alone", () => {
    const hotel = stay({ reservation_type: "hotel" });
    expect(calcBreakfastPrice(hotel)).toBe(72);
    expect(calcRoomPrice(hotel)).toBe(225);

    const venue = stay({ reservation_type: "venue", price_eur: 500 });
    expect(calcBreakfastPrice(venue)).toBe(0);
    expect(calcRoomPrice(venue)).toBe(500);
  });

  it("keeps a whole period balanced across mixed stored rates", () => {
    const rows = [
      stay({ breakfast_price_per_person: 12, price_eur: 297 }),
      stay({
        breakfast_price_per_person: 9.5,
        price_eur: 282,
        guests_count: 3,
      }),
      stay({ breakfast_price_per_person: null, price_eur: 315 }),
      stay({ breakfast_price_per_person: 0, price_eur: 225 }),
      stay({
        reservation_type: "restaurant",
        pricing_type: "menu",
        price_eur: 80,
      }),
    ];
    let room = 0;
    let breakfast = 0;
    let charged = 0;
    for (const r of rows) {
      room += Math.round(calcRoomPrice(r) * 100);
      breakfast += Math.round(calcBreakfastPrice(r) * 100);
      charged += Math.round(effectiveChargedTotal(r) * 100);
    }
    // The menu restaurant booking counts as no amount, so the room total of
    // that row is excluded from the charged sum too.
    const menuRow = rows[4];
    expect(effectiveChargedTotal(menuRow)).toBe(0);
    expect(room + breakfast - Math.round(calcRoomPrice(menuRow) * 100)).toBe(
      charged,
    );
  });

  it("public booking still persists the resource rate, never the request body", () => {
    const src = readFileSync(
      path.resolve(
        __dirname,
        "../../supabase/functions/public-booking/index.ts",
      ),
      "utf8",
    );
    // The stored rate comes from the resolved resource and is validated.
    expect(src).toContain(
      "pricingResource?.breakfast_price_per_person != null",
    );
    expect(src).toContain(
      "if (isFinite(bf) && bf >= 0) insertData.breakfast_price_per_person = bf",
    );
    // It must never be taken from the request body.
    expect(src).not.toContain(
      "insertData.breakfast_price_per_person = body.breakfast_price_per_person",
    );
  });
});
