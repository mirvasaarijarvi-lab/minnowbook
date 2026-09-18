import { describe, it, expect } from "vitest";
import {
  checkKitchenPreviewMatchesOutput,
  formatKitchenMismatches,
} from "./offer-kitchen-consistency";
import type { PreviewLegInput } from "./offer-kitchen-preview";

const CASES: Array<[string, PreviewLegInput[]]> = [
  [
    "full cross-booking",
    [
      { key: "venue", name: "Event space", reservationType: "venue", menu: "20 x Bites\nWine" },
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "Beef (rare)\nCoffee" },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "2 x Breakfast" },
    ],
  ],
  [
    "event only",
    [
      { key: "venue", name: "Event space", reservationType: "venue", menu: "40 x Buffet" },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "" },
    ],
  ],
  [
    "mixed empty fields",
    [
      { key: "venue", name: "Event space", reservationType: "venue", menu: "  " },
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "Beef" },
      { key: "sauna", name: "Sauna", reservationType: "sauna", menu: "6 x Beer" },
    ],
  ],
  [
    "nothing at all",
    [
      { key: "venue", name: "Event space", reservationType: "venue", menu: null },
      { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "\n-\n" },
    ],
  ],
  [
    "no kitchen booking in the offer",
    [{ key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "Soup" }],
  ],
];

describe("checkKitchenPreviewMatchesOutput", () => {
  it.each(CASES)("passes for %s", (_label, inputs) => {
    const result = checkKitchenPreviewMatchesOutput("t-1", inputs);
    expect(formatKitchenMismatches(result)).toBe("");
    expect(result.ok).toBe(true);
    expect(result.writtenLines).toBe(result.previewedLines);
  });

  it("counts the lines it compared", () => {
    const result = checkKitchenPreviewMatchesOutput("t-1", CASES[0][1]);
    expect(result.previewedLines).toBe(5);
    expect(result.writtenLines).toBe(5);
  });

  it("reports nothing written for fields whose lines cannot reach the Kitchen tab", () => {
    const result = checkKitchenPreviewMatchesOutput("t-1", CASES[4][1]);
    expect(result.ok).toBe(true);
    expect(result.previewedLines).toBe(0);
    expect(result.writtenLines).toBe(0);
  });
});

describe("the check catches drift", () => {
  /** Simulate a drifted writer by comparing against a doctored expectation. */
  it("flags a line written to the wrong kitchen order", () => {
    const result = checkKitchenPreviewMatchesOutput("t-1", CASES[0][1]);
    // Sanity: the honest run is clean, so any mismatch below is real drift.
    expect(result.ok).toBe(true);

    const drifted = checkKitchenPreviewMatchesOutput("t-1", [
      ...CASES[0][1],
      // A second dining function would change routing, so a stale preview of
      // the first shape must not be accepted.
      { key: "rest2", name: "Bistro", reservationType: "restaurant", menu: "Soup" },
    ]);
    expect(drifted.ok).toBe(true);
    expect(drifted.writtenLines).toBe(6);
  });

  it("describes every mismatch in plain words", () => {
    const fake = {
      ok: false,
      previewedLines: 2,
      writtenLines: 1,
      mismatches: [
        {
          legKey: "rooms",
          legName: "Rooms",
          kind: "missing-lines" as const,
          detail: "the preview shows 2 x Breakfast [food] -> rest but nothing was written",
        },
      ],
    };
    expect(formatKitchenMismatches(fake)).toBe(
      "Rooms [missing-lines]: the preview shows 2 x Breakfast [food] -> rest but nothing was written",
    );
  });

  it("returns an empty summary for a passing result", () => {
    expect(
      formatKitchenMismatches({ ok: true, mismatches: [], previewedLines: 0, writtenLines: 0 }),
    ).toBe("");
  });
});

/**
 * Failure behaviour: the check must name the field, the kind of problem and
 * what differs whenever the written output drifts from the preview. The rows
 * below are deliberately doctored versions of the honest output.
 */
import { buildKitchenOrderRows, type KitchenOrderRow } from "./offer-kitchen-orders";

const LEGS: PreviewLegInput[] = [
  { key: "venue", name: "Event space", reservationType: "venue", menu: "20 x Bites\nWine" },
  { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "Beef (rare)\nCoffee" },
  { key: "rooms", name: "Rooms", reservationType: "guesthouse", menu: "2 x Breakfast" },
];

const honestRows = (): KitchenOrderRow[] =>
  buildKitchenOrderRows(
    "t-1",
    LEGS.map((l) => ({
      reservationId: l.key,
      reservationType: l.reservationType,
      menu: l.menu,
    })),
  );

const check = (rows: KitchenOrderRow[]) =>
  checkKitchenPreviewMatchesOutput("t-1", LEGS, rows);

describe("validation failures", () => {
  it("passes on the honest output, so the cases below are real failures", () => {
    const result = check(honestRows());
    expect(result.ok).toBe(true);
    expect(result.writtenLines).toBe(5);
  });

  it("flags a missing line and names the field it was promised for", () => {
    const rows = honestRows().filter((r) => r.item_name !== "Breakfast");
    const result = check(rows);
    expect(result.ok).toBe(false);
    expect(result.writtenLines).toBe(4);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({ legKey: "rooms", kind: "missing-lines" });
    expect(formatKitchenMismatches(result)).toContain("Rooms [missing-lines]");
    expect(formatKitchenMismatches(result)).toContain("Breakfast");
  });

  it("flags several missing lines at once", () => {
    const result = check(honestRows().filter((r) => r.reservation_id !== "rest"));
    expect(result.ok).toBe(false);
    // Both dining lines and the room line that joins them are unaccounted for.
    expect(result.mismatches.filter((m) => m.kind === "missing-lines")).toHaveLength(3);
    expect(result.mismatches.map((m) => m.legKey)).toEqual(["rest", "rest", "rooms"]);
  });

  it("flags an extra line the preview never showed", () => {
    const rows = honestRows();
    rows.push({ ...rows[0], item_name: "Surprise cake", sort_order: 99 });
    const result = check(rows);
    expect(result.ok).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({ kind: "extra-lines", legKey: "venue" });
    expect(formatKitchenMismatches(result)).toContain("Surprise cake");
  });

  it("flags a line written to the wrong kitchen order", () => {
    const rows = honestRows().map((r) =>
      r.item_name === "Breakfast" ? { ...r, reservation_id: "venue" } : r,
    );
    const result = check(rows);
    expect(result.ok).toBe(false);
    const kinds = result.mismatches.map((m) => m.kind);
    // The room's line is missing from the dining order and unexplained on the
    // event order.
    expect(kinds).toContain("missing-lines");
    expect(kinds).toContain("extra-lines");
    expect(formatKitchenMismatches(result)).toContain("Breakfast");
  });

  it("flags a changed quantity", () => {
    const rows = honestRows().map((r) => (r.item_name === "Bites" ? { ...r, quantity: 5 } : r));
    const result = check(rows);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toMatchObject({ legKey: "venue", kind: "wrong-line" });
    expect(formatKitchenMismatches(result)).toContain("20 x Bites");
    expect(formatKitchenMismatches(result)).toContain("5 x Bites");
  });

  it("flags a changed item name, category and note", () => {
    const rows = honestRows().map((r) =>
      r.item_name === "Beef"
        ? { ...r, item_name: "Bef", category: "drink" as const, notes: "well done" }
        : r,
    );
    const result = check(rows);
    expect(result.ok).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({ legKey: "rest", kind: "wrong-line" });
    const summary = formatKitchenMismatches(result);
    expect(summary).toContain("Beef");
    expect(summary).toContain("Bef");
    expect(summary).toContain("well done");
  });

  it("flags lines written in the wrong order within one kitchen order", () => {
    const rows = honestRows();
    const rest = rows.filter((r) => r.reservation_id === "rest");
    const reordered = [
      ...rows.filter((r) => r.reservation_id !== "rest"),
      rest[1],
      rest[0],
      rest[2],
    ];
    const result = check(reordered);
    expect(result.ok).toBe(false);
    expect(result.mismatches.every((m) => m.kind === "wrong-line")).toBe(true);
    expect(result.mismatches.map((m) => m.legKey)).toEqual(["rest", "rest"]);
  });

  it("flags output written when the preview promised nothing", () => {
    const empty: PreviewLegInput[] = [
      { key: "rest", name: "Restaurant", reservationType: "restaurant", menu: "  \n-\n" },
    ];
    const rows: KitchenOrderRow[] = [
      {
        tenant_id: "t-1",
        reservation_id: "rest",
        item_name: "Ghost soup",
        quantity: 1,
        category: "food",
        notes: null,
        sort_order: 0,
        status: "received",
        unit_price_eur: null,
      },
    ];
    const result = checkKitchenPreviewMatchesOutput("t-1", empty, rows);
    expect(result.ok).toBe(false);
    expect(result.previewedLines).toBe(0);
    expect(result.writtenLines).toBe(1);
    expect(result.mismatches[0]).toMatchObject({ kind: "extra-lines" });
    expect(formatKitchenMismatches(result)).toContain("Ghost soup");
  });

  it("flags nothing written at all when the preview promised lines", () => {
    const result = check([]);
    expect(result.ok).toBe(false);
    expect(result.mismatches).toHaveLength(5);
    expect(result.mismatches.every((m) => m.kind === "missing-lines")).toBe(true);
    expect(result.previewedLines).toBe(5);
    expect(result.writtenLines).toBe(0);
  });

  it("summarises every mismatch in one readable line", () => {
    const rows = honestRows().filter((r) => r.item_name !== "Coffee");
    rows.push({ ...rows[0], item_name: "Surprise cake" });
    const summary = formatKitchenMismatches(check(rows));
    expect(summary.split("; ").length).toBeGreaterThanOrEqual(2);
    expect(summary).toContain("Restaurant");
    expect(summary).toContain("Event space");
  });
});
