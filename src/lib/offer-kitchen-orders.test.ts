import { describe, it, expect } from "vitest";
import {
  buildKitchenOrderDrafts,
  buildKitchenOrderRows,
  categoryForLine,
  pickKitchenReservationId,
  type OfferMenuLeg,
} from "./offer-kitchen-orders";

describe("buildKitchenOrderDrafts", () => {
  it("returns nothing for empty menu text", () => {
    expect(buildKitchenOrderDrafts(null)).toEqual([]);
    expect(buildKitchenOrderDrafts(undefined)).toEqual([]);
    expect(buildKitchenOrderDrafts("   \n\n  ")).toEqual([]);
  });

  it("makes one line per menu item, in order", () => {
    const drafts = buildKitchenOrderDrafts("Starter salad\nRoast beef\nBerry pie");
    expect(drafts.map((d) => d.item_name)).toEqual([
      "Starter salad",
      "Roast beef",
      "Berry pie",
    ]);
    expect(drafts.map((d) => d.sort_order)).toEqual([0, 1, 2]);
    expect(drafts.every((d) => d.quantity === 1)).toBe(true);
  });

  it("reads quantities written in the common shapes", () => {
    const drafts = buildKitchenOrderDrafts(
      ["20 x Roast beef", "12x Salmon", "5 Vegan plate", "Berry pie x 8", "- 3 kpl Soup"].join(
        "\n",
      ),
    );
    expect(drafts.map((d) => [d.item_name, d.quantity])).toEqual([
      ["Roast beef", 20],
      ["Salmon", 12],
      ["Vegan plate", 5],
      ["Berry pie", 8],
      ["Soup", 3],
    ]);
  });

  it("keeps trailing notes out of the item name", () => {
    const drafts = buildKitchenOrderDrafts("2 x Salmon (no dill)\nRoast beef - medium rare");
    expect(drafts[0]).toMatchObject({ item_name: "Salmon", quantity: 2, notes: "no dill" });
    expect(drafts[1]).toMatchObject({ item_name: "Roast beef", notes: "medium rare" });
  });

  it("strips bullet markers and skips blank lines", () => {
    const drafts = buildKitchenOrderDrafts("• Soup\n\n * Bread\n-\n");
    expect(drafts.map((d) => d.item_name)).toEqual(["Soup", "Bread"]);
  });

  it("classifies drinks in English, Finnish and Swedish", () => {
    expect(categoryForLine("Red wine")).toBe("drink");
    expect(categoryForLine("Kuohuviini")).toBe("drink");
    expect(categoryForLine("Kaffe")).toBe("drink");
    expect(categoryForLine("Roast beef")).toBe("food");
    const drafts = buildKitchenOrderDrafts("20 x Roast beef\n20 x Red wine");
    expect(drafts.map((d) => d.category)).toEqual(["food", "drink"]);
  });
});

describe("pickKitchenReservationId", () => {
  const legs: OfferMenuLeg[] = [
    { reservationId: "r-venue", reservationType: "venue", menu: "Buffet" },
    { reservationId: "r-room", reservationType: "guesthouse" },
    { reservationId: "r-rest", reservationType: "restaurant", menu: null },
  ];

  it("keeps menu lines on a leg the Kitchen tab shows", () => {
    expect(pickKitchenReservationId(legs, legs[0])).toBe("r-venue");
    expect(pickKitchenReservationId(legs, legs[2])).toBe("r-rest");
  });

  it("moves menu lines from a non-kitchen leg to the restaurant leg", () => {
    expect(pickKitchenReservationId(legs, legs[1])).toBe("r-rest");
  });

  it("falls back to a venue leg when there is no restaurant leg", () => {
    const noRestaurant = legs.filter((l) => l.reservationType !== "restaurant");
    expect(pickKitchenReservationId(noRestaurant, noRestaurant[1])).toBe("r-venue");
  });

  it("returns null when no leg is visible in the Kitchen tab", () => {
    const rooms: OfferMenuLeg[] = [{ reservationId: "r-room", reservationType: "guesthouse" }];
    expect(pickKitchenReservationId(rooms, rooms[0])).toBeNull();
  });
});

describe("buildKitchenOrderRows", () => {
  it("stamps tenant, reservation and received status on every row", () => {
    const rows = buildKitchenOrderRows("t-1", [
      { reservationId: "r-1", reservationType: "restaurant", menu: "Soup\n2 x Red wine" },
    ]);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.tenant_id).toBe("t-1");
      expect(row.reservation_id).toBe("r-1");
      expect(row.status).toBe("received");
      expect(row.unit_price_eur).toBeNull();
    }
    expect(rows.map((r) => r.sort_order)).toEqual([0, 1]);
  });

  it("merges menus from several legs onto one reservation with stable order", () => {
    const rows = buildKitchenOrderRows("t-1", [
      { reservationId: "r-venue", reservationType: "venue", menu: "Welcome bites" },
      { reservationId: "r-room", reservationType: "guesthouse", menu: "Breakfast basket" },
    ]);
    // The room leg is not shown in the Kitchen tab, so its menu joins the venue.
    expect(rows.map((r) => [r.reservation_id, r.item_name, r.sort_order])).toEqual([
      ["r-venue", "Welcome bites", 0],
      ["r-venue", "Breakfast basket", 1],
    ]);
  });

  it("writes nothing when there is no menu or no kitchen leg", () => {
    expect(buildKitchenOrderRows("t-1", [
      { reservationId: "r-1", reservationType: "venue", menu: null },
    ])).toEqual([]);
    expect(buildKitchenOrderRows("t-1", [
      { reservationId: "r-1", reservationType: "guesthouse", menu: "Soup" },
    ])).toEqual([]);
    expect(buildKitchenOrderRows("t-1", [
      { reservationId: null, reservationType: "restaurant", menu: "Soup" },
    ])).toEqual([]);
  });
});
