import { describe, it, expect } from "vitest";
import { computeReservationPrice } from "./reservation-pricing";

describe("computeReservationPrice", () => {
  it("hotel: room nights x price x multiplier + breakfast", () => {
    const r = computeReservationPrice({
      reservation_type: "hotel",
      resource: { price_per_night: 100, breakfast_price_per_person: 10 },
      check_in_date: "2026-01-01",
      check_out_date: "2026-01-04", // 3 nights
      room_type: "double", // default 1.5
      guests_count: 2,
      breakfast_included: true,
    });
    // 3 * 100 * 1.5 = 450 + 3*2*10 = 60 => 510
    expect(r.gross_eur).toBe(510);
    expect(r.final_eur).toBe(510);
    expect(r.nights).toBe(3);
    expect(r.derived_from_resource).toBe(true);
  });

  it("custom sub-services sum with qty", () => {
    const r = computeReservationPrice({
      reservation_type: "custom",
      selected_sub_services: [
        { price_eur: 25, qty: 2 },
        { price_eur: 10, qty: 1 },
      ],
    });
    expect(r.gross_eur).toBe(60);
    expect(r.derived_from_resource).toBe(true);
  });

  it("percentage discount applied to gross", () => {
    const r = computeReservationPrice({
      reservation_type: "custom",
      selected_sub_services: [{ price_eur: 100, qty: 1 }],
      discount_type: "percentage",
      discount_value: 20,
    });
    expect(r.gross_eur).toBe(100);
    expect(r.final_eur).toBe(80);
  });

  it("fixed discount cannot push final below zero", () => {
    const r = computeReservationPrice({
      reservation_type: "custom",
      selected_sub_services: [{ price_eur: 50, qty: 1 }],
      discount_type: "fixed",
      discount_value: 999,
    });
    expect(r.final_eur).toBe(0);
  });

  it("free_nights discount subtracts up to n nights", () => {
    const r = computeReservationPrice({
      reservation_type: "hotel",
      resource: { price_per_night: 100 },
      check_in_date: "2026-01-01",
      check_out_date: "2026-01-04", // 3 nights, single (1.0)
      room_type: "single",
      discount_type: "free_nights",
      discount_value: 1,
    });
    // gross 300, minus 1 night (100) => 200
    expect(r.gross_eur).toBe(300);
    expect(r.final_eur).toBe(200);
  });

  it("restaurant fixed_price clamps to max sub_services price (anti-tamper)", () => {
    const r = computeReservationPrice({
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      pricing_type: "fixed_price",
      fixed_price_eur: 9999, // tampered client value
      resource: {
        sub_services: [
          { name: "Lunch", price_eur: 25 },
          { name: "Dinner", price_eur: 50 },
        ],
      },
    });
    expect(r.gross_eur).toBe(50);
    expect(r.derived_from_resource).toBe(true);
  });

  it("staff manual_price_eur used as fallback when no auto source", () => {
    const r = computeReservationPrice({
      reservation_type: "venue",
      manual_price_eur: 250,
    });
    expect(r.gross_eur).toBe(250);
    expect(r.final_eur).toBe(250);
    expect(r.derived_from_resource).toBe(false);
  });

  it("returns nulls when nothing computable", () => {
    const r = computeReservationPrice({ reservation_type: "venue" });
    expect(r.gross_eur).toBeNull();
    expect(r.final_eur).toBeNull();
  });
});
