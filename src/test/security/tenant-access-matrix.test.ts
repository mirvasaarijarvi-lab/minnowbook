/**
 * Offline verification of the tenant access checks that end up in the RLS
 * report. Runs the full allow/deny matrix through the classifier AND through
 * the report's guard-table renderer, so a regression in either one is caught
 * without a database, network access or a live tenant pair.
 */
import { describe, it, expect } from "vitest";
import {
  TENANT_ACCESS_MATRIX,
  evaluateTenantAccess,
  type TenantAccessVerdict,
} from "./fixtures/tenant-access-matrix";
import {
  renderTenantGuardSection,
  membershipBadge,
  renderMembershipRow,
} from "./rls-report-reporter";

describe("tenant access matrix", () => {
  it("covers allow, deny and inconclusive outcomes", () => {
    const verdicts = new Set<TenantAccessVerdict>(
      TENANT_ACCESS_MATRIX.map((c) => c.expected),
    );
    expect(verdicts).toEqual(new Set(["allowed", "denied", "inconclusive"]));
    // Deny cases must dominate: this is a security guard, not a happy-path demo.
    const denied = TENANT_ACCESS_MATRIX.filter((c) => c.expected === "denied");
    expect(denied.length).toBeGreaterThanOrEqual(8);
  });

  it("uses unique labels so report diffs stay readable", () => {
    const labels = TENANT_ACCESS_MATRIX.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  describe.each(TENANT_ACCESS_MATRIX.map((c) => [c.label, c] as const))(
    "%s",
    (_label, testCase) => {
      it(`classifies as ${testCase.expected}`, () => {
        const result = evaluateTenantAccess(testCase.record);
        expect(result.verdict).toBe(testCase.expected);
        for (const reason of testCase.expectedReasons) {
          expect(result.reasons, `missing reason ${reason}`).toContain(reason);
        }
        if (testCase.expected === "allowed") expect(result.reasons).toEqual([]);
        else expect(result.reasons.length).toBeGreaterThan(0);
      });

      it("renders the outcome in the report guard table", () => {
        const html = renderTenantGuardSection([testCase.record]);
        expect(html).toContain("Tenant-pair guard");
        for (const marker of testCase.expectedHtml) {
          expect(html, `missing marker ${marker}`).toContain(marker);
        }
        // A denied pair must never render as a clean pass.
        if (testCase.expected === "denied") {
          const looksClean =
            !html.includes("probe ✗") &&
            !html.includes("no row") &&
            !html.includes("lookup error") &&
            !html.includes("not approved") &&
            !html.includes("guard-failure") &&
            !html.includes("—") &&
            !html.includes("not-a-uuid") &&
            testCase.record.tenantA !== testCase.record.tenantB;
          expect(
            looksClean,
            "denied pair rendered without any warning marker",
          ).toBe(false);
        }
      });
    },
  );

  it("omits the guard section entirely when no tenant pair was used", () => {
    // Anon-only runs (e.g. storage privacy checks) never invoke the guard;
    // an empty table would be misleading noise.
    expect(renderTenantGuardSection([])).toBe("");
  });

  it("renders one row per suite when several suites report", () => {
    const html = renderTenantGuardSection([
      { ...TENANT_ACCESS_MATRIX[0].record, suite: "cross-tenant-rls" },
      { ...TENANT_ACCESS_MATRIX[3].record, suite: "cross-tenant-storage" },
    ]);
    expect(html).toContain("cross-tenant-rls");
    expect(html).toContain("cross-tenant-storage");
    expect(html.match(/<tr>/g)?.length).toBe(3); // header row + two suite rows
  });

  it("maps probe outcomes to distinct badges", () => {
    expect(membershipBadge(true)).toContain("probe ✓");
    expect(membershipBadge(false)).toContain("probe ✗");
    expect(membershipBadge("skipped")).toContain("skipped");
    expect(membershipBadge(true)).not.toContain("fail");
    expect(membershipBadge(false)).toContain("fail");
  });

  it("escapes membership data so report output cannot be injected", () => {
    const html = renderMembershipRow({
      role: "<img src=x onerror=alert(1)>",
      customRoleKey: "\"'&<>",
      isApproved: true,
      found: true,
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;");
  });

  it("shows a placeholder when no membership row was captured", () => {
    expect(renderMembershipRow(undefined)).toContain("—");
  });
});
