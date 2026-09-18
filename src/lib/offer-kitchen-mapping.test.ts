import { describe, it, expect } from "vitest";
import { buildKitchenPreview, type PreviewLegInput } from "./offer-kitchen-preview";
import { buildKitchenOrderRows } from "./offer-kitchen-orders";

/**
 * Mapping contract for cross-bookings: every function's own food and drinks
 * field must land on the correct dining (restaurant) or event (venue) kitchen
 * order, and the preview shown in the offer form must agree with what the
 * confirmation actually writes.
 */

const NON_KITCHEN_TYPES = ["guesthouse", "hotel", "cottage", "sauna", "meeting", "activity"];

function inputs(...legs: PreviewLegInput[]) {
  return legs;
}

describe("each function maps to the right dining or event kitchen order", () => {
  it("keeps the dining field on the dining booking and the event field on the event booking", () => {
    const preview = buildKitchenPreview(
      inputs(
        { key: "venue", name: "Event space", reservationType: "venue", menu: "20 x Welcome bites" },
        { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "20 x Roast beef" },
      ),
    );
    expect(preview.legs.map((l) => [l.key, l.targetKey, l.staysHere])).toEqual([
      ["venue", "venue", true],
      ["rest", "rest", true],
    ]);
  });

  it.each(NON_KITCHEN_TYPES)(
    "sends a %s field to the dining booking when the offer has one",
    (type) => {
      const preview = buildKitchenPreview(
        inputs(
          { key: "venue", name: "Event space", reservationType: "venue" },
          { key: "rest", name: "Restaurant", reservationType: "restaurant" },
          { key: type, name: type, reservationType: type, menu: "2 x Breakfast basket" },
        ),
      );
      const leg = preview.legs[2];
      expect(leg.ownKitchenOrder).toBe(false);
      expect(leg.routeKey).toBe("rest");
      expect(leg.targetKey).toBe("rest");
      expect(leg.targetName).toBe("Restaurant");
    },
  );

  it.each(NON_KITCHEN_TYPES)(
    "sends a %s field to the event booking when there is no dining booking",
    (type) => {
      const preview = buildKitchenPreview(
        inputs(
          { key: "venue", name: "Event space", reservationType: "venue" },
          { key: type, name: type, reservationType: type, menu: "Soup" },
        ),
      );
      expect(preview.legs[1].routeKey).toBe("venue");
      expect(preview.legs[1].targetName).toBe("Event space");
    },
  );

  it.each(NON_KITCHEN_TYPES)(
    "reports no receiver for a %s field when the offer has neither dining nor event",
    (type) => {
      const preview = buildKitchenPreview(
        inputs({ key: type, name: type, reservationType: type, menu: "Soup" }),
      );
      expect(preview.legs[0].routeKey).toBeNull();
      expect(preview.legs[0].targetKey).toBeNull();
      expect(preview.totalLines).toBe(0);
    },
  );

  it("prefers the dining booking over the event booking for every non-kitchen field at once", () => {
    const preview = buildKitchenPreview(
      inputs(
        { key: "venue", name: "Event space", reservationType: "venue", menu: "Bites" },
        { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "Beef" },
        { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "Breakfast" },
        { key: "sauna", name: "Sauna", reservationType: "sauna", menu: "Beer" },
      ),
    );
    expect(preview.legs.map((l) => l.routeKey)).toEqual(["venue", "rest", "rest", "rest"]);
    expect(preview.totalLines).toBe(4);
  });
});

describe("preview matches what the confirmation writes", () => {
  const cases: PreviewLegInput[][] = [
    inputs(
      { key: "venue", name: "Event space", reservationType: "venue", menu: "Bites\nSparkling wine" },
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "Beef\nCoffee" },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "Breakfast basket" },
    ),
    inputs(
      { key: "venue", name: "Event space", reservationType: "venue", menu: "Bites" },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "Breakfast" },
    ),
    inputs(
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "  \n- \n" },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "Soup" },
    ),
    inputs({ key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "Soup" }),
  ];

  it.each(cases.map((c, i) => [i, c] as const))(
    "case %i routes and counts the same lines in the form and on confirm",
    (_i, legs) => {
      const preview = buildKitchenPreview(legs);
      const rows = buildKitchenOrderRows(
        "t-1",
        legs.map((l) => ({
          reservationId: l.key,
          reservationType: l.reservationType,
          menu: l.menu,
        })),
      );
      expect(rows).toHaveLength(preview.totalLines);

      const expected = preview.legs.flatMap((leg) =>
        leg.targetKey ? leg.lines.map((line) => [leg.targetKey, line.item_name]) : [],
      );
      const actual = rows.map((r) => [r.reservation_id, r.item_name]);
      // Same target per line, regardless of the order rows are grouped in.
      expect([...actual].sort()).toEqual([...expected].sort());
    },
  );

  it("never writes a row onto a function that is not on the Kitchen tab", () => {
    for (const legs of cases) {
      const rows = buildKitchenOrderRows(
        "t-1",
        legs.map((l) => ({
          reservationId: l.key,
          reservationType: l.reservationType,
          menu: l.menu,
        })),
      );
      const typeByKey = new Map(legs.map((l) => [l.key, l.reservationType]));
      for (const row of rows) {
        expect(["restaurant", "venue"]).toContain(typeByKey.get(row.reservation_id));
      }
    }
  });
});

/**
 * Empty food and drinks fields must never produce a kitchen order, and must
 * never spill content onto another function's dining or event kitchen order.
 */
const EMPTY_VARIANTS: Array<[string, string | null | undefined]> = [
  ["missing", undefined],
  ["null", null],
  ["empty string", ""],
  ["spaces", "   "],
  ["tabs and newlines", "\t\n \n"],
  ["blank lines", "\n\n\n"],
  ["dash only", "-"],
  ["bullet only", "•"],
  ["star bullets", " * \n * \n"],
  ["carriage returns", "\r\n\r\n"],
];

describe("empty menu fields create no kitchen order", () => {
  it.each(EMPTY_VARIANTS)("a %s dining field writes nothing for the dining booking", (_label, menu) => {
    const legs = inputs(
      { key: "venue", name: "Event space", reservationType: "venue", menu: "20 x Bites" },
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: null },
    );
    const preview = buildKitchenPreview(legs);
    expect(preview.legs[1].lines).toEqual([]);
    expect(preview.legs[1].targetKey).toBeNull();
    // The mapping is still shown, it simply has nothing to deliver.
    expect(preview.legs[1].routeKey).toBe("rest");
    expect(preview.totalLines).toBe(1);

    const rows = buildKitchenOrderRows(
      "t-1",
      legs.map((l) => ({ reservationId: l.key, reservationType: l.reservationType, menu: l.menu })),
    );
    expect(rows.some((r) => r.reservation_id === "rest")).toBe(false);
    expect(rows.map((r) => r.reservation_id)).toEqual(["venue"]);
  });

  it.each(EMPTY_VARIANTS)("a %s event field writes nothing for the event booking", (_label, menu) => {
    const legs = inputs(
      { key: "venue", name: "Event space", reservationType: "venue", menu },
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "20 x Beef" },
    );
    const rows = buildKitchenOrderRows(
      "t-1",
      legs.map((l) => ({ reservationId: l.key, reservationType: l.reservationType, menu: l.menu })),
    );
    expect(rows.map((r) => [r.reservation_id, r.item_name])).toEqual([["rest", "Beef"]]);
    expect(buildKitchenPreview(legs).legs[0].lines).toEqual([]);
  });

  it.each(EMPTY_VARIANTS)(
    "a %s room field adds nothing to the dining kitchen order it would route to",
    (_label, menu) => {
      const legs = inputs(
        { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "Beef" },
        { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu },
      );
      const rows = buildKitchenOrderRows(
        "t-1",
        legs.map((l) => ({ reservationId: l.key, reservationType: l.reservationType, menu: l.menu })),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ reservation_id: "rest", item_name: "Beef", sort_order: 0 });
    },
  );

  it.each(EMPTY_VARIANTS)("every field %s writes no rows at all", (_label, menu) => {
    const legs = inputs(
      { key: "venue", name: "Event space", reservationType: "venue", menu },
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu },
    );
    const preview = buildKitchenPreview(legs);
    expect(preview.hasLines).toBe(false);
    expect(preview.totalLines).toBe(0);
    expect(
      buildKitchenOrderRows(
        "t-1",
        legs.map((l) => ({ reservationId: l.key, reservationType: l.reservationType, menu: l.menu })),
      ),
    ).toEqual([]);
  });

  it("keeps the sort order of the remaining fields unbroken when one is empty", () => {
    const legs = inputs(
      { key: "venue", name: "Event space", reservationType: "venue", menu: "  " },
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "Beef\nCoffee" },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "Breakfast" },
    );
    const rows = buildKitchenOrderRows(
      "t-1",
      legs.map((l) => ({ reservationId: l.key, reservationType: l.reservationType, menu: l.menu })),
    );
    expect(rows.map((r) => [r.reservation_id, r.item_name, r.sort_order])).toEqual([
      ["rest", "Beef", 0],
      ["rest", "Coffee", 1],
      ["rest", "Breakfast", 2],
    ]);
  });
});
