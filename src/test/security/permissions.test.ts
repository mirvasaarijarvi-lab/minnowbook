import { describe, it, expect } from "vitest";
import {
  PERM_RESERVATIONS_VIEW,
  PERM_ADMIN_MANAGE,
  PERM_SETTINGS_MANAGE,
  PERMISSION_CATEGORIES,
} from "@/lib/permissions";

describe("Permissions - Security Regression Tests", () => {
  it("permission keys use dot-separated namespace format", () => {
    for (const cat of PERMISSION_CATEGORIES) {
      for (const perm of cat.permissions) {
        expect(perm.key).toMatch(/^[a-z]+\.[a-z]+$/);
      }
    }
  });

  it("all permission categories have at least one permission", () => {
    for (const cat of PERMISSION_CATEGORIES) {
      expect(cat.permissions.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate permission keys exist", () => {
    const keys = PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => p.key));
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("critical permissions are defined", () => {
    const allKeys = PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => p.key));
    expect(allKeys).toContain(PERM_RESERVATIONS_VIEW);
    expect(allKeys).toContain(PERM_ADMIN_MANAGE);
    expect(allKeys).toContain(PERM_SETTINGS_MANAGE);
  });

  it("every permission has a translation label key", () => {
    for (const cat of PERMISSION_CATEGORIES) {
      expect(cat.category).toBeTruthy();
      for (const perm of cat.permissions) {
        expect(perm.labelKey).toBeTruthy();
        expect(perm.labelKey).toMatch(/^admin\./);
      }
    }
  });
});
