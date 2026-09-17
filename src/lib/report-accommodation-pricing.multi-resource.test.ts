import { describe, it, expect } from "vitest";
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
 * Edge cases: a single stay spread over several resources.
 *
 * Real bookings are not always one row against one room. A group can take two
 * rooms of different types, a long stay can move between a hotel room and a
 * guesthouse room mid-week, or one leg of a bundle can carry the whole package
 * price while the other legs carry none. Each row keeps the price and the
 * breakfast rate of its own resource, so exports must reconcile per row and in
 * total: the room line plus the breakfast line of every row adds up to that
 * row's charged amount, and the sum over the group equals the sum of the
 * charged amounts, to the cent.
 */

type Row = AccommodationPricingRow & { label: string };

const nightsLater = (start: string, nights: number) =>
  new Date(new Date(start + "T00:00:00Z").getTime() + nights * 86400000)
    .toISOString()
    .slice(0, 10);

const stayRow = (label: string, over: Partial<AccommodationPricingRow>): Row => ({
  label,
  reservation_type: "guesthouse",
  date: "2026-08-01",
  check_out_date: "2026-08-04",
  guests_count: 2,
  breakfast_included: true,
  breakfast_price_per_person: 12,
  price_eur: 297,
  ...over,
});

/** Per-row and total reconciliation, exactly as an export sums its columns. */
const reconcile = (rows: Row[]) => {
  let roomCents = 0;
  let breakfastCents = 0;
  let chargedCents = 0;
  for (const r of rows) {
    const room = calcRoomPrice(r);
    const breakfast = calcBreakfastPrice(r);
    const charged = effectiveChargedTotal(r);
    // Per row: the two report lines equal the row's charged amount.
    expect(roundCents(room + breakfast), `row ${r.label}`).toBe(roundCents(charged));
    roomCents += Math.round(room * 100);
    breakfastCents += Math.round(breakfast * 100);
    chargedCents += Math.round(charged * 100);
  }
  return { roomCents, breakfastCents, chargedCents };
};

describe("stays spanning multiple resources", () => {
  it("keeps each room's own price and breakfast rate in a two-room booking", () => {
    // Same dates, one party, two rooms: a suite at 140/night with 18 EUR
    // breakfast and a twin at 90/night with 12 EUR breakfast.
    const suite = stayRow("suite", {
      breakfast_price_per_person: 18,
      guests_count: 2,
      price_eur: roundCents(140 * 3 + 18 * 2 * 3), // 528
    });
    const twin = stayRow("twin", {
      breakfast_price_per_person: 12,
      guests_count: 3,
      price_eur: roundCents(90 * 3 + 12 * 3 * 3), // 378
    });

    expect(calcBreakfastPrice(suite)).toBe(108);
    expect(calcRoomPrice(suite)).toBe(420);
    expect(calcBreakfastPrice(twin)).toBe(108);
    expect(calcRoomPrice(twin)).toBe(270);

    const { roomCents, breakfastCents, chargedCents } = reconcile([suite, twin]);
    expect(roomCents + breakfastCents).toBe(chargedCents);
    expect(chargedCents).toBe(Math.round((528 + 378) * 100));
  });

  it("reconciles a stay that moves from a hotel room to a guesthouse room", () => {
    const hotelLeg = stayRow("hotel leg", {
      reservation_type: "hotel",
      date: "2026-08-01",
      check_out_date: nightsLater("2026-08-01", 2),
      breakfast_price_per_person: 21.5,
      guests_count: 2,
      price_eur: roundCents(155 * 2 + 21.5 * 2 * 2), // 396
    });
    const houseLeg = stayRow("guesthouse leg", {
      date: "2026-08-03",
      check_out_date: nightsLater("2026-08-03", 4),
      breakfast_price_per_person: 8.95,
      guests_count: 2,
      price_eur: roundCents(78 * 4 + 8.95 * 2 * 4), // 383.6
    });

    expect(calcNights(hotelLeg)).toBe(2);
    expect(calcNights(houseLeg)).toBe(4);
    expect(calcBreakfastPrice(hotelLeg)).toBe(86);
    expect(calcBreakfastPrice(houseLeg)).toBe(71.6);

    const { roomCents, breakfastCents, chargedCents } = reconcile([hotelLeg, houseLeg]);
    expect(roomCents + breakfastCents).toBe(chargedCents);
    expect(chargedCents).toBe(Math.round((396 + 383.6) * 100));
  });

  it("handles a bundle where one leg carries the package price and others carry none", () => {
    const roomLeg = stayRow("package room", {
      breakfast_price_per_person: 14,
      guests_count: 4,
      price_eur: roundCents(210 * 3 + 14 * 4 * 3), // 798
    });
    const secondRoomLeg = stayRow("package extra room", {
      breakfast_price_per_person: 14,
      guests_count: 2,
      price_eur: null, // priced within the package leg
    });
    const dinnerLeg = stayRow("package dinner", {
      reservation_type: "restaurant",
      pricing_type: "menu",
      breakfast_included: false,
      breakfast_price_per_person: null,
      price_eur: null,
    });

    expect(calcChargedTotal(secondRoomLeg)).toBe(0);
    expect(calcBreakfastPrice(secondRoomLeg)).toBe(0);
    expect(calcRoomPrice(secondRoomLeg)).toBe(0);
    expect(effectiveChargedTotal(dinnerLeg)).toBe(0);

    const { roomCents, breakfastCents, chargedCents } = reconcile([
      roomLeg,
      secondRoomLeg,
      dinnerLeg,
    ]);
    expect(roomCents + breakfastCents).toBe(chargedCents);
    // The whole bundle is worth exactly the priced leg.
    expect(chargedCents).toBe(Math.round(798 * 100));
  });

  it("mixes stored rates, a missing rate and a discounted leg without drift", () => {
    const stored = stayRow("stored rate", {
      breakfast_price_per_person: 11.11,
      guests_count: 3,
      price_eur: roundCents(96 * 3 + 11.11 * 3 * 3), // 387.99
    });
    const missingRate = stayRow("missing rate", {
      breakfast_price_per_person: null,
      guests_count: 2,
      price_eur: roundCents(96 * 3 + DEFAULT_BREAKFAST_PRICE_PER_PERSON * 2 * 3), // 378
    });
    const discounted = stayRow("discounted leg", {
      breakfast_price_per_person: 12,
      guests_count: 2,
      // 33% off a 297 EUR stay: reports must split what the guest pays.
      price_eur: roundCents(297 * 0.67), // 198.99
    });

    expect(calcBreakfastPrice(missingRate)).toBe(90);
    expect(calcBreakfastPrice(discounted)).toBe(72);
    expect(calcRoomPrice(discounted)).toBe(126.99);

    const { roomCents, breakfastCents, chargedCents } = reconcile([
      stored,
      missingRate,
      discounted,
    ]);
    expect(roomCents + breakfastCents).toBe(chargedCents);
    expect(chargedCents).toBe(Math.round((387.99 + 378 + 198.99) * 100));
  });

  it("reconciles a large multi-resource group across many rate and length combinations", () => {
    const rates = [0, 8.95, 11.11, 12, 15, 21.5, null];
    const nights = [1, 2, 5, 9, 28];
    const parties = [1, 2, 5, 12];
    const rows: Row[] = [];
    let expectedCents = 0;
    let i = 0;
    for (const rate of rates) {
      for (const n of nights) {
        for (const guests of parties) {
          const effectiveRate = rate ?? DEFAULT_BREAKFAST_PRICE_PER_PERSON;
          const charged = roundCents(83.33 * n + effectiveRate * guests * n);
          rows.push(
            stayRow(`row-${i++}`, {
              reservation_type: i % 2 === 0 ? "hotel" : "guesthouse",
              date: "2026-08-01",
              check_out_date: nightsLater("2026-08-01", n),
              guests_count: guests,
              breakfast_price_per_person: rate,
              price_eur: charged,
            }),
          );
          expectedCents += Math.round(charged * 100);
        }
      }
    }

    const { roomCents, breakfastCents, chargedCents } = reconcile(rows);
    expect(roomCents + breakfastCents).toBe(chargedCents);
    expect(chargedCents).toBe(expectedCents);
  });

  it("keeps breakfast capped per resource when one leg is deeply discounted", () => {
    // An 86% discount leaves less than the breakfast component: breakfast is
    // capped at the charged amount and the room line stays at zero, per row.
    const cheapLeg = stayRow("deep discount", {
      breakfast_price_per_person: 18,
      guests_count: 3,
      price_eur: 40,
    });
    const fullLeg = stayRow("full price", {
      breakfast_price_per_person: 18,
      guests_count: 3,
      price_eur: roundCents(120 * 3 + 18 * 3 * 3), // 522
    });

    expect(calcBreakfastPrice(cheapLeg)).toBe(40);
    expect(calcRoomPrice(cheapLeg)).toBe(0);

    const { roomCents, breakfastCents, chargedCents } = reconcile([cheapLeg, fullLeg]);
    expect(roomCents + breakfastCents).toBe(chargedCents);
    expect(chargedCents).toBe(Math.round((40 + 522) * 100));
  });
});
