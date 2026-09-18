import { describe, it, expect } from "vitest";
import {
  resolveOfferReservationPrice,
  pickOfferResource,
} from "./offer-reservation-pricing";

describe("resolveOfferReservationPrice", () => {
  it("uses the resource room price per night for accommodation", () => {
    expect(
      resolveOfferReservationPrice({
        reservation_type: "guesthouse",
        resource: { price_per_night: 89.9 },
        nights: 3,
      }),
    ).toBe(269.7);
  });

  it("defaults accommodation to one night", () => {
    expect(
      resolveOfferReservationPrice({
        reservation_type: "hotel",
        resource: { price_per_night: 120 },
      }),
    ).toBe(120);
  });

  it("matches a named sub-service price", () => {
    expect(
      resolveOfferReservationPrice({
        reservation_type: "restaurant",
        space: " Dinner ",
        resource: {
          sub_services: [
            { name: "Lunch", price_eur: 25 },
            { name: "Dinner", price_eur: 50 },
          ],
        },
      }),
    ).toBe(50);
  });

  it("uses the only priced sub-service when no space is given", () => {
    expect(
      resolveOfferReservationPrice({
        reservation_type: "venue",
        resource: { sub_services: [{ name: "Hall", price_eur: 400 }] },
      }),
    ).toBe(400);
  });

  it("returns null when the configuration is ambiguous", () => {
    expect(
      resolveOfferReservationPrice({
        reservation_type: "venue",
        resource: {
          sub_services: [
            { name: "Hall A", price_eur: 400 },
            { name: "Hall B", price_eur: 600 },
          ],
        },
      }),
    ).toBeNull();
  });

  it("returns null without a resource or price", () => {
    expect(
      resolveOfferReservationPrice({ reservation_type: "venue" }),
    ).toBeNull();
    expect(
      resolveOfferReservationPrice({
        reservation_type: "guesthouse",
        resource: { price_per_night: 0 },
      }),
    ).toBeNull();
  });
});

describe("pickOfferResource", () => {
  const resources = [
    { name: "Main Hall", resource_type: "venue", sub_services: null },
    { name: "Sauna", resource_type: "wellness", sub_services: null },
  ];

  it("prefers an exact name match", () => {
    expect(
      pickOfferResource(resources, { name: "sauna", reservation_type: "venue" })
        ?.name,
    ).toBe("Sauna");
  });

  it("falls back to the reservation type", () => {
    expect(
      pickOfferResource(resources, { name: null, reservation_type: "venue" })
        ?.name,
    ).toBe("Main Hall");
  });

  it("returns null when nothing matches", () => {
    expect(
      pickOfferResource(resources, { name: "x", reservation_type: "hotel" }),
    ).toBeNull();
  });
});
