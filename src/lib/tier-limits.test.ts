import { describe, it, expect } from "vitest";
import {
  getTierLimits,
  canSelectMoreTypes,
  canCreateResourceOfType,
  isResourceTypeAllowed,
} from "./tier-limits";

describe("tier-limits: Professional tier", () => {
  const tier = "professional";

  it("exposes maxReservationTypes = 5 with no per-type cap", () => {
    const limits = getTierLimits(tier);
    expect(limits.maxReservationTypes).toBe(5);
    expect(limits.maxResourcesPerType).toBeNull();
    expect(limits.maxResourcesTotal).toBeNull();
  });

  it("allows selecting up to 5 reservation types", () => {
    expect(canSelectMoreTypes(tier, 0)).toBe(true);
    expect(canSelectMoreTypes(tier, 4)).toBe(true);
    expect(canSelectMoreTypes(tier, 5)).toBe(false);
    expect(canSelectMoreTypes(tier, 6)).toBe(false);
  });

  it("permits any combination of types incl. custom up to 5", () => {
    const allowed = ["restaurant", "hotel", "guesthouse", "venue", "custom"];
    expect(allowed.length).toBe(5);
    for (const t of allowed) {
      expect(isResourceTypeAllowed(tier, t, allowed)).toBe(true);
    }
    // Adding a 6th would exceed (e.g., a duplicate custom slot, conceptually)
    expect(canSelectMoreTypes(tier, allowed.length)).toBe(false);
  });

  it("permits multi-custom combos within 5 slots", () => {
    // E.g., 2 restaurants, 1 hotel, 2 custom labels (treated as separate type slots)
    const combo = ["restaurant", "restaurant", "hotel", "custom", "custom"];
    expect(combo.length).toBeLessThanOrEqual(5);
    expect(canSelectMoreTypes(tier, combo.length)).toBe(false);
    expect(canSelectMoreTypes(tier, combo.length - 1)).toBe(true);
  });

  it("does not enforce a per-type or total resource cap", () => {
    const many = Array.from({ length: 50 }, () => ({ resource_type: "custom" }));
    expect(canCreateResourceOfType(tier, "custom", many)).toBe(true);
    expect(canCreateResourceOfType(tier, "restaurant", many)).toBe(true);
  });
});

describe("tier-limits: Basic tier (regression)", () => {
  const tier = "basic";

  it("caps reservation types at 2", () => {
    expect(canSelectMoreTypes(tier, 1)).toBe(true);
    expect(canSelectMoreTypes(tier, 2)).toBe(false);
  });

  it("caps total resources at 2 regardless of type", () => {
    const two = [{ resource_type: "restaurant" }, { resource_type: "hotel" }];
    expect(canCreateResourceOfType(tier, "custom", two)).toBe(false);
    expect(canCreateResourceOfType(tier, "custom", two.slice(0, 1))).toBe(true);
  });
});

describe("tier-limits: Business tier (regression)", () => {
  const tier = "business";

  it("has no caps", () => {
    expect(canSelectMoreTypes(tier, 999)).toBe(true);
    const many = Array.from({ length: 1000 }, () => ({ resource_type: "custom" }));
    expect(canCreateResourceOfType(tier, "custom", many)).toBe(true);
  });
});
