import { describe, it, expect } from "vitest";
import { DEFAULT_STAFFING_SETTINGS as D, defaultRolesFor, hourlyNeeds, normalizeStaffingSettings, suggestStaff } from "./staffingNeeds";

describe("staffing needs", () => {
  it("offers roles for the business's resource types without duplicates", () => {
    const keys = defaultRolesFor(["restaurant", "venue"]).map((r) => r.key);
    expect(keys.filter((k) => k === "waiter")).toHaveLength(1);
    expect(defaultRolesFor([]).map((r) => r.key)).toEqual(["staff"]);
  });
  it("suggests staff from guests with a minimum", () => {
    expect(suggestStaff("restaurant", 25, D)).toBe(3);
    expect(suggestStaff("restaurant", 2, D)).toBe(1);
    expect(suggestStaff("restaurant", 0, D)).toBe(0);
  });
  it("flags understaffed hours against the shift list", () => {
    const h = hourlyNeeds(
      [{ reservation_type: "restaurant", start_time: "18:00", end_time: "20:00", guests: 30 }],
      [{ start_time: "17:00", end_time: "22:00" }],
      D,
    );
    expect(h[18]).toMatchObject({ guests: 30, needed: 3, rostered: 1, understaffed: true });
    expect(h[21]).toMatchObject({ needed: 0, understaffed: false });
  });
  it("ignores malformed stored settings", () => {
    const s = normalizeStaffingSettings({ minStaff: "x", guestsPerStaff: { restaurant: -4 }, rules: { eveningStart: 99999 } });
    expect(s.minStaff).toBe(D.minStaff);
    expect(s.guestsPerStaff.restaurant).toBe(12);
    expect(s.rules.eveningStart).toBe(D.rules.eveningStart);
  });
});
