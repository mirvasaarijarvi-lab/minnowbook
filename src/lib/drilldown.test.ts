import { describe, it, expect } from "vitest";
import {
  availableModes,
  filterPath,
  groupRows,
  UNASSIGNED,
  type DrillContext,
  type DrillReservation,
} from "./drilldown";

const ctx: DrillContext = {
  resourceNames: { r1: "Sauna A" },
  occasions: { o1: { name: "Tour", resource_id: "r1", capacity: 10 } },
};
const rows: DrillReservation[] = [
  {
    id: "1",
    date: "2026-09-01",
    reservation_type: "sauna",
    guests_count: 4,
    price_eur: 80,
    original_price_eur: 100,
    special_occasion_id: "o1",
  },
  {
    id: "2",
    date: "2026-09-02",
    reservation_type: "sauna",
    guests_count: 2,
    price_eur: 40,
    created_by: "u",
    selected_sub_services: [{ id: "s1", name: "Towel", qty: 2, price_eur: 5 }],
  },
  {
    id: "3",
    date: "2026-09-03",
    reservation_type: "guesthouse",
    guests_count: 1,
    price_eur: 60,
    status: "cancelled",
    room_type: "Double",
  },
];

describe("drilldown", () => {
  it("groups by service type", () => {
    const g = groupRows(rows, "resource", 0, ctx);
    expect(g.find((r) => r.key === "sauna")).toMatchObject({
      bookings: 2,
      guests: 6,
      revenue: 120,
      discount: 20,
    });
    expect(g.find((r) => r.key === "guesthouse")).toMatchObject({
      cancelled: 1,
      revenue: 0,
    });
  });
  it("resolves resources via occasion, room type or unassigned", () => {
    const keys = groupRows(rows, "resource", 1, ctx)
      .map((r) => r.key)
      .sort();
    expect(keys).toEqual([UNASSIGNED, "res:r1", "room:Double"].sort());
  });
  it("sums sub-service revenue and quantity", () => {
    expect(groupRows(rows, "subService", 1, ctx)).toEqual([
      expect.objectContaining({ key: "s1", revenue: 10, guests: 2 }),
    ]);
  });
  it("groups by weekday, group size and new vs returning", () => {
    const withPrior = { ...ctx, priorGuests: new Set(["a@x.test"]) };
    const rs = [
      { ...rows[0], guest_email: "A@x.test" },
      { ...rows[1], guest_email: "b@x.test" },
    ];
    expect(
      groupRows(rs, "guestType", 1, withPrior)
        .map((r) => r.key)
        .sort(),
    ).toEqual(["new", "returning"]);
    expect(
      groupRows(rows, "weekday", 1, ctx).find((r) => r.key === "2")?.bookings,
    ).toBe(1);
    expect(
      groupRows(rows, "groupSize", 1, ctx)
        .map((r) => r.key)
        .sort(),
    ).toEqual(["1 to 2", "3 to 5"]);
  });
  it("filters a path and lists modes with data", () => {
    expect(
      filterPath(rows, "channel", "sauna", "staff", ctx).map((r) => r.id),
    ).toEqual(["2"]);
    expect(availableModes(rows, ctx)).toEqual([
      "resource",
      "channel",
      "weekday",
      "groupSize",
      "subService",
      "occasion",
    ]);
  });
});
