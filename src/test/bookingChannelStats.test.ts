import { describe, it, expect } from "vitest";
import {
  computeChannelSplit,
  computeChannelSplitByType,
  resolveChannel,
  buildTrendBuckets,
} from "@/lib/bookingChannelStats";
import { enUS } from "date-fns/locale";

const row = (date: string, type: string, createdBy: string | null) => ({
  date,
  reservation_type: type,
  created_by: createdBy,
});

describe("bookingChannelStats", () => {
  it("treats rows without created_by as public bookings", () => {
    expect(resolveChannel(row("2026-01-01", "restaurant", null))).toBe(
      "public",
    );
    expect(resolveChannel(row("2026-01-01", "restaurant", "user-1"))).toBe(
      "staff",
    );
  });

  it("splits percentages so they always add up to 100", () => {
    const split = computeChannelSplit([
      row("2026-01-01", "restaurant", null),
      row("2026-01-02", "restaurant", null),
      row("2026-01-03", "restaurant", "u1"),
    ]);
    expect(split).toMatchObject({ total: 3, publicCount: 2, staffCount: 1 });
    expect(split.publicPct + split.staffPct).toBe(100);
  });

  it("returns zeroes for an empty period", () => {
    expect(computeChannelSplit([])).toEqual({
      total: 0,
      publicCount: 0,
      staffCount: 0,
      publicPct: 0,
      staffPct: 0,
    });
  });

  it("reports a split per service type plus an overall roll-up", () => {
    const byType = computeChannelSplitByType(
      [row("2026-01-01", "restaurant", null), row("2026-01-01", "hotel", "u1")],
      ["restaurant", "hotel"],
    );
    expect(byType.all.total).toBe(2);
    expect(byType.restaurant.publicCount).toBe(1);
    expect(byType.hotel.staffCount).toBe(1);
  });

  it("buckets the trend by month keeping channels apart", () => {
    const buckets = buildTrendBuckets({
      rows: [
        row("2026-01-05", "restaurant", null),
        row("2026-01-20", "restaurant", "u1"),
        row("2026-02-02", "restaurant", null),
      ],
      start: new Date(2026, 0, 1),
      end: new Date(2026, 1, 28),
      dateLocale: enUS,
      granularity: "month",
    });
    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({ publicCount: 1, staffCount: 1 });
    expect(buckets[1]).toMatchObject({ publicCount: 1, staffCount: 0 });
  });
});
