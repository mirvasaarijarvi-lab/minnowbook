/**
 * Combined roles, overlapping permissions, and decision consistency.
 *
 * Cross-tenant suites run the same guard record through the classifier many
 * times (once per suite, once per report render, once per retry). A decision
 * that flips between attempts, or that lets a privileged role on one side
 * paper over a problem on the other, would let a real isolation break through.
 *
 * This suite pins:
 *   - combined role pairs (owner/staff, custom roles, redundant overlaps),
 *   - overlapping identities (same auth user or same login email on both
 *     sides), which make a "cross-tenant" attempt same-user and must deny,
 *   - the deny-dominance rule: no role, custom key or approval on one side
 *     can rescue a problem on the other,
 *   - determinism: same record, same verdict and same reason codes on every
 *     attempt, in any evaluation order.
 *
 * Fully offline: no database, no network.
 */
import { describe, expect, it } from "vitest";
import {
  TENANT_ACCESS_MATRIX,
  evaluateTenantAccess,
  type TenantAccessVerdict,
} from "./fixtures/tenant-access-matrix";
import { renderTenantGuardSection } from "./rls-report-reporter";
import type { TenantGuardRecord, TenantMembershipSnapshot } from "./fixtures/tenant-guard-record";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

function record(
  a: TenantMembershipSnapshot,
  b: TenantMembershipSnapshot,
  overrides: Partial<TenantGuardRecord> = {},
): TenantGuardRecord {
  return {
    suite: "role-overlap",
    recordedAt: "2026-01-01T00:00:00.000Z",
    tenantA: TENANT_A,
    tenantB: TENANT_B,
    membershipA: true,
    membershipB: true,
    emailA: "a@example.test",
    emailB: "b@example.test",
    membershipRowA: a,
    membershipRowB: b,
    ...overrides,
  };
}

const approved = (
  role: string | null,
  customRoleKey?: string,
  userId = "u-a",
): TenantMembershipSnapshot => ({ role, customRoleKey, isApproved: true, userId, found: true });

const unapproved = (role: string, userId = "u-a"): TenantMembershipSnapshot => ({
  role,
  isApproved: false,
  userId,
  found: true,
});

/** Every combination of enum roles the product uses, both sides approved. */
const ROLES = ["owner", "admin", "manager", "staff"] as const;
const CUSTOM_KEYS = ["front_desk", "kitchen_lead", "tenant_admin", "site_manager"] as const;

describe("combined roles and overlapping permissions", () => {
  describe("approved role combinations are allowed", () => {
    const pairs = ROLES.flatMap((a) => ROLES.map((b) => [a, b] as const));
    it.each(pairs)("allows %s in tenant A with %s in tenant B", (roleA, roleB) => {
      const evaluation = evaluateTenantAccess(
        record(approved(roleA, undefined, "u-a"), approved(roleB, undefined, "u-b")),
      );
      expect(evaluation.verdict).toBe("allowed");
      expect(evaluation.reasons).toEqual([]);
    });

    it.each(CUSTOM_KEYS.flatMap((a) => CUSTOM_KEYS.map((b) => [a, b] as const)))(
      "allows custom role %s alongside custom role %s",
      (keyA, keyB) => {
        const evaluation = evaluateTenantAccess(
          record(approved("staff", keyA, "u-a"), approved("staff", keyB, "u-b")),
        );
        expect(evaluation.verdict).toBe("allowed");
      },
    );

    it("allows a custom key that duplicates the enum role", () => {
      expect(
        evaluateTenantAccess(record(approved("owner", "owner", "u-a"), approved("owner", "owner", "u-b")))
          .verdict,
      ).toBe("allowed");
    });

    it("allows a custom-role-only membership with a null enum role", () => {
      expect(
        evaluateTenantAccess(record(approved(null, "site_manager", "u-a"), approved("staff", undefined, "u-b")))
          .verdict,
      ).toBe("allowed");
    });
  });

  describe("no privilege on one side rescues a problem on the other", () => {
    const problems: Array<{ label: string; make: () => TenantGuardRecord; reason: string }> = [
      {
        label: "unapproved membership on side A",
        make: () => record(unapproved("owner"), approved("staff", "tenant_admin", "u-b")),
        reason: "membership_not_approved_A",
      },
      {
        label: "unapproved membership on side B",
        make: () => record(approved("owner", "tenant_admin"), unapproved("owner", "u-b")),
        reason: "membership_not_approved_B",
      },
      {
        label: "failed probe on side B",
        make: () =>
          record(approved("owner", "tenant_admin"), approved("owner", "tenant_admin", "u-b"), {
            membershipB: false,
          }),
        reason: "membership_probe_failed_B",
      },
      {
        label: "missing membership row on side B",
        make: () => record(approved("owner", "tenant_admin"), { found: false }),
        reason: "membership_row_missing_B",
      },
      {
        label: "membership lookup error on side A",
        make: () =>
          record({ found: false, lookupError: "permission denied" }, approved("owner", "tenant_admin", "u-b")),
        reason: "membership_lookup_error_A",
      },
      {
        label: "guard precondition failure",
        make: () =>
          record(approved("owner", "tenant_admin"), approved("owner", "tenant_admin", "u-b"), {
            failure: "tenant ids must differ",
          }),
        reason: "guard_failure",
      },
    ];

    it.each(problems.map((p) => [p.label, p] as const))("denies despite privileges: %s", (_l, p) => {
      const evaluation = evaluateTenantAccess(p.make());
      expect(evaluation.verdict).toBe("denied");
      expect(evaluation.reasons).toContain(p.reason);
    });

    it("denies for every privileged role paired with an unapproved counterpart", () => {
      for (const role of ROLES) {
        for (const key of CUSTOM_KEYS) {
          const evaluation = evaluateTenantAccess(
            record(approved(role, key), unapproved("owner", "u-b")),
          );
          expect(evaluation.verdict).toBe("denied");
          expect(evaluation.reasons).toContain("membership_not_approved_B");
        }
      }
    });
  });

  describe("overlapping identities", () => {
    it("denies when the same auth user acts for both tenants", () => {
      const evaluation = evaluateTenantAccess(
        record(approved("owner", undefined, "u-shared"), approved("staff", undefined, "u-shared")),
      );
      expect(evaluation.verdict).toBe("denied");
      expect(evaluation.reasons).toContain("same_user_both_tenants");
    });

    it("denies when the same login email is used, ignoring case and whitespace", () => {
      for (const emailB of ["shared@example.test", "Shared@Example.Test", " shared@example.test "]) {
        const evaluation = evaluateTenantAccess(
          record(approved("owner"), approved("staff", undefined, "u-b"), {
            emailA: "shared@example.test",
            emailB,
          }),
        );
        expect(evaluation.verdict).toBe("denied");
        expect(evaluation.reasons).toContain("same_identity_both_tenants");
      }
    });

    it("still allows two different users with similar looking accounts", () => {
      const evaluation = evaluateTenantAccess(
        record(approved("owner", undefined, "u-a"), approved("owner", undefined, "u-b"), {
          emailA: "owner+a@example.test",
          emailB: "owner+b@example.test",
        }),
      );
      expect(evaluation.verdict).toBe("allowed");
    });

    it("reports both the identity overlap and any other problem", () => {
      const evaluation = evaluateTenantAccess(
        record(approved("owner", undefined, "u-shared"), unapproved("staff", "u-shared")),
      );
      expect(evaluation.reasons).toContain("same_user_both_tenants");
      expect(evaluation.reasons).toContain("membership_not_approved_B");
    });
  });

  describe("decisions stay consistent across attempts", () => {
    const all = TENANT_ACCESS_MATRIX;

    it.each(all.map((c) => [c.label, c] as const))(
      "repeats the same verdict and reasons on every attempt: %s",
      (_label, c) => {
        const first = evaluateTenantAccess(c.record);
        for (let attempt = 0; attempt < 10; attempt++) {
          const again = evaluateTenantAccess(c.record);
          expect(again.verdict).toBe(first.verdict);
          expect(again.reasons).toEqual(first.reasons);
        }
        expect(first.verdict).toBe(c.expected);
      },
    );

    it("evaluates records independently of the order they are processed in", () => {
      const expected = new Map<string, TenantAccessVerdict>(
        all.map((c) => [c.label, evaluateTenantAccess(c.record).verdict]),
      );
      const shuffled = [...all].reverse();
      for (const c of shuffled) {
        expect(evaluateTenantAccess(c.record).verdict).toBe(expected.get(c.label));
      }
      // Interleaved batches must not share state either.
      for (let i = 0; i < all.length; i++) {
        const a = all[i];
        const b = all[all.length - 1 - i];
        expect(evaluateTenantAccess(a.record).verdict).toBe(expected.get(a.label));
        expect(evaluateTenantAccess(b.record).verdict).toBe(expected.get(b.label));
      }
    });

    it("never mutates the record it evaluates", () => {
      for (const c of all) {
        const before = JSON.stringify(c.record);
        evaluateTenantAccess(c.record);
        expect(JSON.stringify(c.record)).toBe(before);
      }
    });

    it("renders the same guard HTML on repeated attempts", () => {
      for (const c of all) {
        const once = renderTenantGuardSection([c.record]);
        expect(renderTenantGuardSection([c.record])).toBe(once);
      }
    });

    it("covers combined-role and overlap cases in the shared matrix", () => {
      const labels = all.map((c) => c.label).join(" | ");
      for (const needle of [
        "combined roles",
        "overlapping custom roles",
        "redundant overlap",
        "custom role only",
        "same auth user",
        "same login email",
        "overlapping identity",
      ]) {
        expect(labels, `matrix is missing a case for: ${needle}`).toContain(needle);
      }
    });
  });
});
