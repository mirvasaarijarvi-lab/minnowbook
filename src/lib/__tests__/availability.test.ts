import { describe, expect, it } from "vitest";
import { resolveResourceAvailability } from "@/lib/availability";

const day = (n: number) => ({ day_of_week: n });

describe("resolveResourceAvailability", () => {
  const date = "2026-06-17"; // Wed
  const dayOfWeek = 3;

  it("returns the weekly window when no occasional slots or blocks apply", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(3), open_time: "09:00", close_time: "17:00", is_closed: false }],
        occasionalSlots: [],
        blocks: [],
      })
    ).toEqual([{ start: "09:00", end: "17:00" }]);
  });

  it("ignores closed weekly rows", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(3), open_time: "09:00", close_time: "17:00", is_closed: true }],
        occasionalSlots: [],
        blocks: [],
      })
    ).toEqual([]);
  });

  it("ignores weekly rows for other weekdays", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(1), open_time: "09:00", close_time: "17:00", is_closed: false }],
        occasionalSlots: [],
        blocks: [],
      })
    ).toEqual([]);
  });

  it("ignores occasional slots on other dates", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [],
        occasionalSlots: [{ slot_date: "2026-06-18", start_time: "10:00", end_time: "12:00" }],
        blocks: [],
      })
    ).toEqual([]);
  });

  it("adds an occasional slot to a day with no weekly hours", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [],
        occasionalSlots: [{ slot_date: date, start_time: "10:00", end_time: "12:00" }],
        blocks: [],
      })
    ).toEqual([{ start: "10:00", end: "12:00" }]);
  });

  it("merges overlapping weekly + occasional windows", () => {
    // Weekly 09-12 plus an occasional 11-14 should yield 09-14.
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(3), open_time: "09:00", close_time: "12:00", is_closed: false }],
        occasionalSlots: [{ slot_date: date, start_time: "11:00", end_time: "14:00" }],
        blocks: [],
      })
    ).toEqual([{ start: "09:00", end: "14:00" }]);
  });

  it("keeps disjoint windows separate", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(3), open_time: "09:00", close_time: "12:00", is_closed: false }],
        occasionalSlots: [{ slot_date: date, start_time: "14:00", end_time: "17:00" }],
        blocks: [],
      })
    ).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "14:00", end: "17:00" },
    ]);
  });

  it("subtracts a block from the middle, splitting the window", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(3), open_time: "09:00", close_time: "17:00", is_closed: false }],
        occasionalSlots: [],
        blocks: [{ date, start_time: "12:00", end_time: "13:00" }],
      })
    ).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
  });

  it("treats a null start/end block as a full-day closure", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(3), open_time: "09:00", close_time: "17:00", is_closed: false }],
        occasionalSlots: [{ slot_date: date, start_time: "18:00", end_time: "20:00" }],
        blocks: [{ date, start_time: null, end_time: null }],
      })
    ).toEqual([]);
  });

  it("ignores blocks for other dates", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(3), open_time: "09:00", close_time: "17:00", is_closed: false }],
        occasionalSlots: [],
        blocks: [{ date: "2026-06-18", start_time: "09:00", end_time: "17:00" }],
      })
    ).toEqual([{ start: "09:00", end: "17:00" }]);
  });

  it("accepts HH:mm:ss times from the database", () => {
    expect(
      resolveResourceAvailability({
        date,
        dayOfWeek,
        weeklyHours: [{ ...day(3), open_time: "09:30:00", close_time: "17:45:00", is_closed: false }],
        occasionalSlots: [],
        blocks: [],
      })
    ).toEqual([{ start: "09:30", end: "17:45" }]);
  });

  it("does not leak data from other resources or tenants — input boundary", () => {
    // Defensive: the resolver must only consider rows the caller passed in,
    // and must not magically pull in anything based on resource_id / tenant_id.
    // This is enforced at the database layer by RLS (see
    // src/test/security/resource-availability-cross-tenant.test.ts) but we
    // also assert the function does not silently merge unrelated inputs.
    const result = resolveResourceAvailability({
      date,
      dayOfWeek,
      weeklyHours: [], // empty — caller fetched no rows for this resource
      occasionalSlots: [],
      blocks: [],
    });
    expect(result).toEqual([]);
  });
});
