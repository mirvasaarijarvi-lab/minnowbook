import { describe, it, expect } from "vitest";
import { buildKitchenPreview } from "./offer-kitchen-preview";

describe("buildKitchenPreview", () => {
  it("shows nothing to cook when no field has content", () => {
    const preview = buildKitchenPreview([
      { key: "main", name: "Event space", reservationType: "venue", menu: "  \n" },
      { key: "guesthouse", name: "Rooms", reservationType: "guesthouse" },
    ]);
    expect(preview.hasLines).toBe(false);
    expect(preview.totalLines).toBe(0);
    expect(preview.legs.map((l) => l.lines.length)).toEqual([0, 0]);
  });

  it("keeps each kitchen function's lines on itself", () => {
    const preview = buildKitchenPreview([
      { key: "main", name: "Event space", reservationType: "venue", menu: "20 x Welcome bites" },
      { key: "restaurant", name: "Restaurant", reservationType: "restaurant", menu: "20 x Coffee" },
    ]);
    expect(preview.totalLines).toBe(2);
    expect(preview.legs[0]).toMatchObject({ targetKey: "main", staysHere: true });
    expect(preview.legs[1]).toMatchObject({ targetKey: "restaurant", staysHere: true });
    expect(preview.legs[1].lines[0]).toMatchObject({
      item_name: "Coffee",
      quantity: 20,
      category: "drink",
    });
  });

  it("moves a room field to the dining function and names it", () => {
    const preview = buildKitchenPreview([
      { key: "main", name: "Event space", reservationType: "venue", menu: null },
      { key: "restaurant", name: "Restaurant", reservationType: "restaurant", menu: null },
      {
        key: "guesthouse",
        name: "Rooms",
        reservationType: "guesthouse",
        menu: "2 x Breakfast basket (no egg)",
      },
    ]);
    const room = preview.legs[2];
    expect(room.staysHere).toBe(false);
    expect(room.targetKey).toBe("restaurant");
    expect(room.targetName).toBe("Restaurant");
    expect(room.lines[0]).toMatchObject({ quantity: 2, notes: "no egg" });
    expect(preview.totalLines).toBe(1);
  });

  it("reports lines as lost when no function appears in the Kitchen tab", () => {
    const preview = buildKitchenPreview([
      { key: "guesthouse", name: "Rooms", reservationType: "guesthouse", menu: "Soup" },
    ]);
    expect(preview.legs[0].lines).toHaveLength(1);
    expect(preview.legs[0].targetKey).toBeNull();
    expect(preview.totalLines).toBe(0);
    expect(preview.hasLines).toBe(false);
  });
});

describe("empty menu field on one function", () => {
  it("creates no lines for that function while the others are unaffected", () => {
    const preview = buildKitchenPreview([
      { key: "main", name: "Event space", reservationType: "venue", menu: "20 x Welcome bites" },
      // Empty, whitespace-only and bullet-only fields must all add nothing.
      { key: "restaurant", name: "Restaurant", reservationType: "restaurant", menu: "  \n\t\n- \n" },
      { key: "guesthouse", name: "Rooms", reservationType: "guesthouse", menu: "" },
    ]);
    expect(preview.legs[1].lines).toEqual([]);
    expect(preview.legs[1].targetKey).toBeNull();
    expect(preview.legs[2].lines).toEqual([]);
    expect(preview.totalLines).toBe(1);
    expect(preview.legs[0].lines).toHaveLength(1);
  });
});
