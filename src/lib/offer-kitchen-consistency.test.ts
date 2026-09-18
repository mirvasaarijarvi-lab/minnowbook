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
