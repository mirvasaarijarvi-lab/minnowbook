import { describe, it, expect } from "vitest";
import {
  buildTypeTiles,
  selectTile,
  type SiteResource,
} from "./booking-tiles";

describe("buildTypeTiles — public booking custom resource tiles", () => {
  it("renders one tile per built-in reservation type", () => {
    const tiles = buildTypeTiles(["restaurant", "venue", "hotel"], []);
    expect(tiles).toHaveLength(3);
    expect(tiles.map((t) => t.key)).toEqual(["restaurant", "venue", "hotel"]);
    expect(tiles.every((t) => t.kind === "builtin")).toBe(true);
  });

  it("does NOT render a generic 'custom' tile when custom is allowed", () => {
    const tiles = buildTypeTiles(["restaurant", "custom"], []);
    expect(tiles.find((t) => t.key === "custom")).toBeUndefined();
  });

  it("renders one tile per custom resource using custom_type_label", () => {
    const resources: SiteResource[] = [
      { id: "r1", resource_type: "custom", custom_type_label: "Spa", name: "Spa Room" },
      { id: "r2", resource_type: "custom", custom_type_label: "Hair Salon", name: "Salon A" },
      { id: "r3", resource_type: "restaurant", name: "Main Dining" },
    ];
    const tiles = buildTypeTiles(["restaurant", "custom"], resources);

    // 1 builtin (restaurant) + 2 custom resource tiles
    expect(tiles).toHaveLength(3);

    const customTiles = tiles.filter((t) => t.kind === "custom");
    expect(customTiles).toHaveLength(2);

    expect(customTiles[0]).toMatchObject({
      kind: "custom",
      key: "custom:r1",
      resourceId: "r1",
      label: "Spa",
    });
    expect(customTiles[1]).toMatchObject({
      kind: "custom",
      key: "custom:r2",
      resourceId: "r2",
      label: "Hair Salon",
    });
  });

  it("falls back to resource name when custom_type_label is missing", () => {
    const tiles = buildTypeTiles(
      ["custom"],
      [{ id: "r1", resource_type: "custom", name: "Yoga Studio" }],
    );
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ label: "Yoga Studio", key: "custom:r1" });
  });

  it("falls back to literal 'Custom' when both label and name are missing", () => {
    const tiles = buildTypeTiles(
      ["custom"],
      [{ id: "r1", resource_type: "custom" }],
    );
    expect(tiles[0].kind === "custom" && tiles[0].label).toBe("Custom");
  });

  it("does not render custom tiles when 'custom' is NOT in allowedTypes", () => {
    const tiles = buildTypeTiles(
      ["restaurant"],
      [{ id: "r1", resource_type: "custom", custom_type_label: "Spa" }],
    );
    expect(tiles).toHaveLength(1);
    expect(tiles[0].key).toBe("restaurant");
  });

  it("includes sub_services array on custom tiles when present", () => {
    const tiles = buildTypeTiles(
      ["custom"],
      [
        {
          id: "r1",
          resource_type: "custom",
          custom_type_label: "Spa",
          sub_services: [
            { id: "s1", name: "Massage", price_eur: 60 },
            { id: "s2", name: "Facial", price_eur: 45 },
          ],
        },
      ],
    );
    const tile = tiles[0];
    expect(tile.kind).toBe("custom");
    if (tile.kind === "custom") {
      expect(tile.subServices).toHaveLength(2);
      expect(tile.subServices[0]).toMatchObject({ id: "s1", name: "Massage", price_eur: 60 });
    }
  });

  it("defaults sub_services to [] when missing or non-array", () => {
    const tiles = buildTypeTiles(
      ["custom"],
      [
        { id: "r1", resource_type: "custom", custom_type_label: "A" },
        { id: "r2", resource_type: "custom", custom_type_label: "B", sub_services: "not-an-array" },
      ],
    );
    expect((tiles[0] as any).subServices).toEqual([]);
    expect((tiles[1] as any).subServices).toEqual([]);
  });

  it("preserves the order: built-ins first, then custom resources in given order", () => {
    const tiles = buildTypeTiles(
      ["custom", "restaurant", "hotel"],
      [
        { id: "rA", resource_type: "custom", custom_type_label: "Alpha" },
        { id: "rB", resource_type: "custom", custom_type_label: "Bravo" },
      ],
    );
    expect(tiles.map((t) => t.key)).toEqual([
      "restaurant",
      "hotel",
      "custom:rA",
      "custom:rB",
    ]);
  });

  it("each custom tile has a unique key (no collisions across resources)", () => {
    const tiles = buildTypeTiles(
      ["custom"],
      [
        { id: "r1", resource_type: "custom", custom_type_label: "Same Label" },
        { id: "r2", resource_type: "custom", custom_type_label: "Same Label" },
      ],
    );
    const keys = tiles.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["custom:r1", "custom:r2"]);
  });
});

describe("selectTile — clicking a tile sets booking form state", () => {
  it("selecting a built-in tile sets reservation_type and clears resource_id", () => {
    const patch = selectTile({ kind: "builtin", key: "restaurant", type: "restaurant" });
    expect(patch).toEqual({
      reservation_type: "restaurant",
      resource_id: "",
      selected_sub_services: [],
    });
  });

  it("selecting a custom tile pins reservation_type='custom' AND the specific resource_id", () => {
    const patch = selectTile({
      kind: "custom",
      key: "custom:r1",
      resourceId: "r1",
      label: "Spa",
      subServices: [],
    });
    expect(patch).toEqual({
      reservation_type: "custom",
      resource_id: "r1",
      selected_sub_services: [],
    });
  });

  it("selecting a different custom tile swaps to its resource_id", () => {
    const a = selectTile({
      kind: "custom",
      key: "custom:rA",
      resourceId: "rA",
      label: "Spa",
      subServices: [],
    });
    const b = selectTile({
      kind: "custom",
      key: "custom:rB",
      resourceId: "rB",
      label: "Salon",
      subServices: [],
    });
    expect(a.resource_id).toBe("rA");
    expect(b.resource_id).toBe("rB");
    expect(a.reservation_type).toBe(b.reservation_type);
  });
});
