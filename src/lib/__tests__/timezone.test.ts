import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  getEffectiveTimezone,
  isValidTimezone,
  tzDayOfWeek,
  tzNow,
  tzToday,
} from "@/lib/timezone";

describe("getEffectiveTimezone", () => {
  it("prefers resource over tenant", () => {
    expect(
      getEffectiveTimezone({ resourceTz: "Europe/Paris", tenantTz: "Europe/Helsinki" })
    ).toEqual({ tz: "Europe/Paris", source: "resource" });
  });

  it("falls back to tenant when resource is empty", () => {
    expect(getEffectiveTimezone({ resourceTz: "  ", tenantTz: "Europe/Helsinki" })).toEqual({
      tz: "Europe/Helsinki",
      source: "tenant",
    });
  });

  it("falls back to the platform default when both are empty", () => {
    expect(getEffectiveTimezone({ resourceTz: null, tenantTz: null })).toEqual({
      tz: DEFAULT_TIMEZONE,
      source: "default",
    });
  });
});

describe("tzToday / tzNow", () => {
  it("returns the wall-clock date in the target timezone", () => {
    // 2026-06-17 22:30 UTC -> Auckland is +12, so already 2026-06-18.
    const fixed = new Date("2026-06-17T22:30:00Z");
    expect(tzToday("Pacific/Auckland", fixed)).toBe("2026-06-18");
    expect(tzToday("Europe/Helsinki", fixed)).toBe("2026-06-18"); // EEST = +3
    expect(tzToday("America/Los_Angeles", fixed)).toBe("2026-06-17");
  });

  it("returns the wall-clock time in the target timezone", () => {
    const fixed = new Date("2026-06-17T22:30:00Z");
    expect(tzNow("Europe/Helsinki", fixed)).toEqual({ date: "2026-06-18", time: "01:30" });
  });
});

describe("tzDayOfWeek", () => {
  it("maps ISO dates to weekday index (Sun=0)", () => {
    expect(tzDayOfWeek("2026-06-15", "Europe/Helsinki")).toBe(1); // Monday
    expect(tzDayOfWeek("2026-06-21", "Europe/Helsinki")).toBe(0); // Sunday
  });
});

describe("isValidTimezone", () => {
  it("accepts known IANA zones", () => {
    expect(isValidTimezone("Europe/Helsinki")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
  });
  it("rejects nonsense", () => {
    expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
  });
});
