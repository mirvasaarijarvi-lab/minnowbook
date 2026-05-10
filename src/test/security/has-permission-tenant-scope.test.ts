import { describe, it, expect, beforeAll } from "vitest";
import {
  createTenantPairFixture,
  tenantPairFixtureLikelyAvailable,
  tenantPairFixtureSkipReason,
  type TenantPairFixture,
} from "./fixtures/tenant-pair";

/**
 * Regression tests for the cross-tenant `has_permission` privilege escalation
 * fix (security-scan finding `PRIVILEGE_ESCALATION_CROSS_TENANT`).
 *
 * What used to be broken:
 *   `has_permission(user, perm)` granted the permission if the user was an
 *   `owner` or `superadmin` in ANY tenant, with no tenant-id filter. So an
 *   owner of Tenant A passed permission checks against Tenant B's data
 *   (notably the `booking_validation_log` INSERT policy).
 *
 * What this file asserts:
 *   1. The new tenant-scoped overload `has_permission(uid, perm, tenant_id)`
 *      returns TRUE for the user's OWN tenant and FALSE for the other
 *      tenant, regardless of being an owner there.
 *   2. The `booking_validation_log` INSERT policy now blocks inserts where
 *      `tenant_id` belongs to a tenant the user is not a member of.
 *   3. Positive control: each owner CAN insert into their own tenant's
 *      validation log, so the negative result above is not just "all
 *      inserts are denied" misconfiguration.
 *
 * Skips automatically when the tenant-pair fixture is unavailable (no
 * service-role key and no explicit RLS_TEST_TENANT_* env vars). On the
 * staging CI it auto-provisions two owner accounts via service role.
 */

const fixtureLikelyAvailable = tenantPairFixtureLikelyAvailable();
const skipReason = tenantPairFixtureSkipReason();

describe.runIf(fixtureLikelyAvailable)(
  "has_permission tenant scoping (PRIVILEGE_ESCALATION_CROSS_TENANT regression)",
  () => {
    let fixture: TenantPairFixture;

    beforeAll(async () => {
      fixture = await createTenantPairFixture();
      if (!fixture.available) {
        // eslint-disable-next-line no-console
        console.warn(
          `[has-permission-tenant-scope] fixture unavailable: ${fixture.skipReason}`,
        );
      }
    });

    it("returns true for the user's own tenant", async () => {
      if (!fixture.available || !fixture.a) return;
      const { data, error } = await fixture.a.client.rpc("has_permission", {
        p_user_id: fixture.a.userId,
        p_permission: "reservations.create",
        p_tenant_id: fixture.a.tenantId,
      });
      expect(error, `has_permission RPC failed: ${error?.message}`).toBeNull();
      expect(data).toBe(true);
    });

    it("returns FALSE when checked against the OTHER tenant (owner-shortcut no longer leaks)", async () => {
      if (!fixture.available || !fixture.a || !fixture.b) return;
      // User A is owner of Tenant A. With the old (buggy) function this
      // call would return TRUE because the owner shortcut wasn't tenant
      // scoped. With the fix it must return FALSE.
      const { data, error } = await fixture.a.client.rpc("has_permission", {
        p_user_id: fixture.a.userId,
        p_permission: "reservations.create",
        p_tenant_id: fixture.b.tenantId,
      });
      expect(error, `has_permission RPC failed: ${error?.message}`).toBeNull();
      expect(
        data,
        "Owner of Tenant A must NOT have permissions on Tenant B",
      ).toBe(false);
    });

    it("symmetric check: owner of B has no permission on A", async () => {
      if (!fixture.available || !fixture.a || !fixture.b) return;
      const { data, error } = await fixture.b.client.rpc("has_permission", {
        p_user_id: fixture.b.userId,
        p_permission: "reservations.create",
        p_tenant_id: fixture.a.tenantId,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it("RLS: blocks INSERT into booking_validation_log for the other tenant", async () => {
      if (!fixture.available || !fixture.a || !fixture.b) return;

      const { error } = await fixture.a.client
        .from("booking_validation_log")
        .insert({
          tenant_id: fixture.b.tenantId, // <-- forging the other tenant
          source: "regression-test",
          outcome: "rejected",
          reasons: [{ code: "regression_probe" }],
        });

      expect(
        error,
        "Cross-tenant INSERT into booking_validation_log must be denied by RLS",
      ).not.toBeNull();
    });

    it("RLS positive control: owner CAN insert into their OWN booking_validation_log", async () => {
      if (!fixture.available || !fixture.a) return;

      const { error } = await fixture.a.client
        .from("booking_validation_log")
        .insert({
          tenant_id: fixture.a.tenantId,
          source: "regression-test",
          outcome: "accepted",
          reasons: [{ code: "regression_probe_self" }],
        });

      expect(
        error,
        `Self-tenant INSERT must succeed (positive control). Got: ${error?.message}`,
      ).toBeNull();
    });
  },
);

describe.skipIf(fixtureLikelyAvailable)(
  "has_permission tenant scoping (skipped, fixture unavailable)",
  () => {
    it("skipped: no tenant-pair fixture available", () => {
      // eslint-disable-next-line no-console
      console.info(
        `[has-permission-tenant-scope] skipped: ${skipReason ?? "fixture unavailable"}`,
      );
      expect(true).toBe(true);
    });
  },
);
