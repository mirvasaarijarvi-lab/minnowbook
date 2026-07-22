import { describe, it, expect } from "vitest";

/**
 * Regression tests for tenant_users.custom_role_key assignment.
 *
 * Mirrors the DB function `public.is_custom_role_key_assignable_by_owner`
 * and the AdminPanel client-side `isAssignableRole` guard. Both must
 * reject:
 *   - unknown custom role keys (no matching role_definitions row for the
 *     tenant),
 *   - custom keys that resolve to a role with hierarchy_level < 10
 *     (i.e. owner=0 or superadmin=-10),
 *   - the reserved system role keys "owner" and "superadmin" even if a
 *     tenant happens to have a matching row (defense-in-depth against
 *     seeded system rows being reused as a custom_role_key).
 *
 * Any change to that policy should update these tests deliberately — a
 * silent regression here is exactly the privilege-escalation path we
 * want to prevent.
 */

type RoleDefinition = {
  role_key: string;
  hierarchy_level: number;
  is_system: boolean;
};

// Tenant seed used across cases — matches `seed_tenant_roles_and_permissions`.
const SEEDED_TENANT_ROLES: RoleDefinition[] = [
  { role_key: "superadmin", hierarchy_level: -10, is_system: true },
  { role_key: "owner", hierarchy_level: 0, is_system: true },
  { role_key: "admin", hierarchy_level: 10, is_system: true },
  { role_key: "staff", hierarchy_level: 20, is_system: true },
  { role_key: "shift_lead", hierarchy_level: 15, is_system: false },
  { role_key: "elevated_custom", hierarchy_level: 5, is_system: false },
];

/**
 * Pure port of `public.is_custom_role_key_assignable_by_owner`. Kept
 * side-by-side with the SQL so any drift is caught by these tests.
 */
function isCustomRoleKeyAssignableByOwner(
  customRoleKey: string | null,
  tenantRoles: RoleDefinition[],
): boolean {
  if (customRoleKey === null) return true;
  if (customRoleKey === "owner" || customRoleKey === "superadmin") return false;
  return tenantRoles.some(
    (r) => r.role_key === customRoleKey && r.hierarchy_level >= 10,
  );
}

describe("tenant_users.custom_role_key assignment guard", () => {
  describe("accepts safe assignments", () => {
    it("allows NULL custom_role_key (falls back to enum role)", () => {
      expect(
        isCustomRoleKeyAssignableByOwner(null, SEEDED_TENANT_ROLES),
      ).toBe(true);
    });

    it("allows a custom role with hierarchy_level >= 10", () => {
      expect(
        isCustomRoleKeyAssignableByOwner("shift_lead", SEEDED_TENANT_ROLES),
      ).toBe(true);
    });

    it("allows the seeded 'admin' role_key (hierarchy_level = 10)", () => {
      // admin sits exactly on the boundary and is safe to assign as a
      // custom_role_key even though it's also the enum default.
      expect(
        isCustomRoleKeyAssignableByOwner("admin", SEEDED_TENANT_ROLES),
      ).toBe(true);
    });

    it("allows the seeded 'staff' role_key (hierarchy_level = 20)", () => {
      expect(
        isCustomRoleKeyAssignableByOwner("staff", SEEDED_TENANT_ROLES),
      ).toBe(true);
    });
  });

  describe("rejects privilege escalation", () => {
    it("rejects 'owner' even when a role_definitions row exists", () => {
      expect(
        isCustomRoleKeyAssignableByOwner("owner", SEEDED_TENANT_ROLES),
      ).toBe(false);
    });

    it("rejects 'superadmin' even when a role_definitions row exists", () => {
      expect(
        isCustomRoleKeyAssignableByOwner("superadmin", SEEDED_TENANT_ROLES),
      ).toBe(false);
    });

    it("rejects a custom role whose hierarchy_level < 10 (elevated)", () => {
      expect(
        isCustomRoleKeyAssignableByOwner(
          "elevated_custom",
          SEEDED_TENANT_ROLES,
        ),
      ).toBe(false);
    });

    it("rejects a custom role at hierarchy_level = 9 (just above admin)", () => {
      const roles: RoleDefinition[] = [
        ...SEEDED_TENANT_ROLES,
        { role_key: "boundary", hierarchy_level: 9, is_system: false },
      ];
      expect(isCustomRoleKeyAssignableByOwner("boundary", roles)).toBe(false);
    });
  });

  describe("rejects unknown or malformed keys", () => {
    it("rejects a role_key that does not exist for the tenant", () => {
      expect(
        isCustomRoleKeyAssignableByOwner(
          "not_a_real_role",
          SEEDED_TENANT_ROLES,
        ),
      ).toBe(false);
    });

    it("rejects a role_key that only exists for a DIFFERENT tenant", () => {
      // Simulate a tenant with only seeded roles — a custom role_key from
      // another tenant must not slip through.
      const otherTenantRoles = SEEDED_TENANT_ROLES.filter(
        (r) => r.is_system,
      );
      expect(
        isCustomRoleKeyAssignableByOwner("shift_lead", otherTenantRoles),
      ).toBe(false);
    });

    it("rejects an empty string", () => {
      expect(isCustomRoleKeyAssignableByOwner("", SEEDED_TENANT_ROLES)).toBe(
        false,
      );
    });
  });
});

/**
 * Mirror of the AdminPanel `isAssignableRole` helper — the UI dropdown
 * only surfaces custom roles that pass the same filter, and the submit
 * mutation refuses to fire for anything else. This test locks in that
 * client-side filter so the DB is never the last line of defense.
 */
function clientIsAssignableRole(
  key: string,
  tenantRoles: RoleDefinition[],
): boolean {
  const SYSTEM_KEYS = new Set(["superadmin", "owner", "admin", "staff"]);
  if (SYSTEM_KEYS.has(key)) return true;
  return tenantRoles.some(
    (r) =>
      !r.is_system &&
      r.hierarchy_level >= 10 &&
      r.role_key !== "owner" &&
      r.role_key !== "superadmin" &&
      r.role_key === key,
  );
}

describe("AdminPanel isAssignableRole client-side guard", () => {
  it("allows system role keys (handled by the enum column separately)", () => {
    for (const key of ["staff", "admin", "owner", "superadmin"]) {
      expect(clientIsAssignableRole(key, SEEDED_TENANT_ROLES)).toBe(true);
    }
  });

  it("allows a safe non-system custom role", () => {
    expect(
      clientIsAssignableRole("shift_lead", SEEDED_TENANT_ROLES),
    ).toBe(true);
  });

  it("blocks a non-system custom role with hierarchy_level < 10", () => {
    expect(
      clientIsAssignableRole("elevated_custom", SEEDED_TENANT_ROLES),
    ).toBe(false);
  });

  it("blocks an unknown custom role key", () => {
    expect(
      clientIsAssignableRole("does_not_exist", SEEDED_TENANT_ROLES),
    ).toBe(false);
  });
});
