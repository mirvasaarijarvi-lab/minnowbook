import { describe, it, expect } from "vitest";
import { buildReportCsv, reportCsvFileName } from "./report-csv-export";
import {
  availableModes,
  filterPath,
  groupRows,
  type DrillContext,
  type DrillReservation,
} from "./drilldown";

const base: DrillReservation = {
  id: "a",
  date: "2026-09-07",
  reservation_type: "venue",
  guests_count: 10,
  price_eur: 100,
  resource_id: "r1",
};

const ctx: DrillContext = {
  resourceNames: { r1: "Hall", r2: '=HYPERLINK("http://x")' },
  occasions: {},
  resourceCapacity: { r1: 20 },
  periodDays: 2,
  offerReservationIds: new Set(["a"]),
  kitchenItems: {
    a: [
      { name: "Soup", qty: 10, price: 5 },
      { name: "Cake", qty: 2, price: 4 },
    ],
  },
};

describe("drill-down new groupings", () => {
  const rows: DrillReservation[] = [
    base,
    { ...base, id: "b", guests_count: 4, price_eur: 40 },
  ];

  it("offers the new modes only when data exists", () => {
    const m = availableModes(rows, ctx);
    expect(m).toEqual(
      expect.arrayContaining(["utilisation", "offer", "kitchen"]),
    );
    const bare = availableModes(rows, { resourceNames: {}, occasions: {} });
    expect(bare).not.toContain("utilisation");
    expect(bare).not.toContain("offer");
    expect(bare).not.toContain("kitchen");
  });

  it("uses the saved resource and computes capacity over the period", () => {
    const [row] = groupRows(rows, "utilisation", 1, ctx);
    expect(row.label).toBe("Hall");
    expect(row.guests).toBe(14);
    expect(row.capacity).toBe(40);
  });

  it("splits offer and direct bookings", () => {
    const g = groupRows(rows, "offer", 1, ctx);
    expect(g.find((r) => r.key === "offer")?.bookings).toBe(1);
    expect(g.find((r) => r.key === "direct")?.bookings).toBe(1);
  });

  it("groups kitchen items and filters to their bookings", () => {
    const g = groupRows(rows, "kitchen", 1, ctx);
    expect(g.map((r) => r.label).sort()).toEqual(["Cake", "Soup"]);
    expect(g.find((r) => r.label === "Soup")?.revenue).toBe(50);
    expect(filterPath(rows, "kitchen", null, "soup", ctx)).toHaveLength(1);
  });
});

describe("drill-down download safety", () => {
  it("neutralises spreadsheet formulas in resource names", () => {
    const csv = buildReportCsv(["Resource"], [['=HYPERLINK("http://x")']]);
    expect(csv).not.toMatch(/"=HYPERLINK/);
  });

  it("keeps file names free of path characters", () => {
    const name = reportCsvFileName("drilldown_resource", "../../etc/x: y");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
    expect(name).not.toContain(":");
    expect(name.endsWith(".csv")).toBe(true);
  });
});
