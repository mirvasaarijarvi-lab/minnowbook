/**
 * Tenant identifier edge cases.
 *
 * A bad tenant id is the most dangerous kind of test bug: `.eq("tenant_id",
 * "undefined")` matches nothing, so every denial assertion "passes" while
 * proving nothing. This suite pins the behaviour for missing, null, blank,
 * malformed, duplicated and hostile identifiers across all three layers:
 *
 *   1. `isUuid` / `assertDistinctTenantPairIds` — the guard that must refuse
 *      to start a cross-tenant suite at all.
 *   2. `evaluateTenantAccess` — the report classifier, which must return
 *      DENIED (never allowed, never inconclusive) for every such record.
 *   3. The report's guard table, which must never render such a pair as a
 *      clean pass.
 *
 * Fully offline: no database, no network.
 */
import { describe, expect, it } from "vitest";
import {
  assertDistinctTenantPairIds,
  isUuid,
} from "./fixtures/tenant-id-guard";
import { evaluateTenantAccess } from "./fixtures/tenant-access-matrix";
import { renderTenantGuardSection } from "./rls-report-reporter";
import type { TenantGuardRecord } from "./fixtures/tenant-guard-record";

const VALID_A = "11111111-1111-4111-8111-111111111111";
const VALID_B = "22222222-2222-4222-8222-222222222222";

/** Identifiers that must never be accepted as a tenant id. */
const BAD_IDS: Array<{ label: string; value: unknown }> = [
  { label: "undefined", value: undefined },
  { label: "null", value: null },
  { label: "empty string", value: "" },
  { label: "whitespace only", value: "   " },
  { label: "newline only", value: "\n" },
  { label: 'literal "undefined"', value: "undefined" },
  { label: 'literal "null"', value: "null" },
  { label: 'literal "NaN"', value: "NaN" },
  { label: "tenant slug", value: "wiurila" },
  { label: "numeric id", value: "12345" },
  { label: "number type", value: 12345 },
  { label: "boolean type", value: true },
  { label: "object type", value: { id: VALID_A } },
  { label: "array type", value: [VALID_A] },
  { label: "uuid without hyphens", value: "11111111111141118111111111111111" },
  { label: "uuid too short", value: "11111111-1111-4111-8111-11111111111" },
  { label: "uuid too long", value: "11111111-1111-4111-8111-1111111111111" },
  { label: "uuid with trailing text", value: `${VALID_A}x` },
  { label: "uuid with leading text", value: `x${VALID_A}` },
  { label: "braced uuid", value: `{${VALID_A}}` },
  { label: "urn-prefixed uuid", value: `urn:uuid:${VALID_A}` },
  { label: "non-hex characters", value: "gggggggg-1111-4111-8111-111111111111" },
  { label: "wildcard", value: "*" },
  { label: "sql injection payload", value: "' OR 1=1 --" },
  { label: "sql tautology on the id", value: `${VALID_A}' OR '1'='1` },
  { label: "postgres cast attempt", value: `${VALID_A}::text` },
  { label: "comma-separated list", value: `${VALID_A},${VALID_B}` },
  { label: "unicode lookalike digits", value: "１1111111-1111-4111-8111-111111111111" },
  { label: "path traversal", value: `../${VALID_A}` },
  { label: "url", value: `https://example.test/${VALID_A}` },
];

/** Identifiers that are legitimately valid, including tolerated formatting. */
const GOOD_IDS: Array<{ label: string; value: string }> = [
  { label: "lower-case uuid", value: VALID_A },
  { label: "upper-case uuid", value: VALID_A.toUpperCase() },
  { label: "mixed-case uuid", value: "11111111-1111-4111-8111-11111111AAAA".toLowerCase() },
  { label: "uuid with surrounding whitespace", value: `  ${VALID_A}\n` },
];

function guardRecord(overrides: Partial<TenantGuardRecord>): TenantGuardRecord {
  return {
    suite: "edge-cases",
    recordedAt: "2026-01-01T00:00:00.000Z",
    tenantA: VALID_A,
    tenantB: VALID_B,
    membershipA: true,
    membershipB: true,
    membershipRowA: { role: "owner", isApproved: true, found: true },
    membershipRowB: { role: "owner", isApproved: true, found: true },
    ...overrides,
  };
}

describe("tenant identifier edge cases", () => {
  describe("isUuid", () => {
    it.each(BAD_IDS.map((c) => [c.label, c.value] as const))("rejects %s", (_label, value) => {
      expect(isUuid(value)).toBe(false);
    });

    it.each(GOOD_IDS.map((c) => [c.label, c.value] as const))("accepts %s", (_label, value) => {
      expect(isUuid(value)).toBe(true);
    });
  });

  describe("assertDistinctTenantPairIds", () => {
    it.each(BAD_IDS.map((c) => [c.label, c.value] as const))(
      "refuses to start when tenant A is %s",
      (_label, value) => {
        expect(() => assertDistinctTenantPairIds(value as string, VALID_B)).toThrow();
      },
    );

    it.each(BAD_IDS.map((c) => [c.label, c.value] as const))(
      "refuses to start when tenant B is %s",
      (_label, value) => {
        expect(() => assertDistinctTenantPairIds(VALID_A, value as string)).toThrow();
      },
    );

    it("refuses when both ids are bad", () => {
      expect(() => assertDistinctTenantPairIds("", "")).toThrow(/require both/i);
      expect(() => assertDistinctTenantPairIds("slug-a", "slug-b")).toThrow(/must be UUIDs/i);
    });

    it("explains a missing id differently from a malformed one", () => {
      expect(() => assertDistinctTenantPairIds(undefined, VALID_B)).toThrow(/require both/i);
      expect(() => assertDistinctTenantPairIds("not-a-uuid", VALID_B)).toThrow(/must be UUIDs/i);
    });

    it("refuses a duplicated pair regardless of case or whitespace", () => {
      for (const b of [VALID_A, VALID_A.toUpperCase(), `  ${VALID_A}  `, `${VALID_A}\n`]) {
        expect(() => assertDistinctTenantPairIds(VALID_A, b)).toThrow(/same tenant/i);
      }
    });

    it("accepts a well-formed distinct pair and returns trimmed ids", () => {
      expect(assertDistinctTenantPairIds(`  ${VALID_A} `, `${VALID_B}\n`)).toEqual({
        a: VALID_A,
        b: VALID_B,
      });
    });

    it("never returns a value when it refuses", () => {
      let returned: unknown = "sentinel";
      try {
        returned = assertDistinctTenantPairIds("", "");
      } catch {
        // expected
      }
      expect(returned).toBe("sentinel");
    });
  });

  describe("report classifier denies every bad identifier", () => {
    it.each(BAD_IDS.map((c) => [c.label, c.value] as const))(
      "denies a record whose tenant A is %s",
      (_label, value) => {
        const evaluation = evaluateTenantAccess(
          guardRecord({ tenantA: value as string | undefined }),
        );
        expect(evaluation.verdict).toBe("denied");
        expect(evaluation.reasons.some((r) => r.endsWith("_tenant_a"))).toBe(true);
      },
    );

    it.each(BAD_IDS.map((c) => [c.label, c.value] as const))(
      "denies a record whose tenant B is %s",
      (_label, value) => {
        const evaluation = evaluateTenantAccess(
          guardRecord({ tenantB: value as string | undefined }),
        );
        expect(evaluation.verdict).toBe("denied");
        expect(evaluation.reasons.some((r) => r.endsWith("_tenant_b"))).toBe(true);
      },
    );

    it("separates missing from malformed in the reason codes", () => {
      expect(evaluateTenantAccess(guardRecord({ tenantA: undefined })).reasons).toContain(
        "missing_tenant_a",
      );
      expect(evaluateTenantAccess(guardRecord({ tenantA: "" })).reasons).toContain(
        "missing_tenant_a",
      );
      expect(evaluateTenantAccess(guardRecord({ tenantB: "wiurila" })).reasons).toContain(
        "malformed_tenant_b",
      );
    });

    it("denies both sides at once when both ids are bad", () => {
      const evaluation = evaluateTenantAccess(guardRecord({ tenantA: "", tenantB: "nope" }));
      expect(evaluation.verdict).toBe("denied");
      expect(evaluation.reasons).toContain("missing_tenant_a");
      expect(evaluation.reasons).toContain("malformed_tenant_b");
    });

    it("denies a pair that is the same tenant in disguise", () => {
      for (const b of [VALID_A, VALID_A.toUpperCase(), ` ${VALID_A} `]) {
        const evaluation = evaluateTenantAccess(guardRecord({ tenantB: b }));
        expect(evaluation.verdict).toBe("denied");
        expect(evaluation.reasons).toContain("tenants_not_distinct");
      }
    });

    it("never returns allowed or inconclusive for a bad identifier", () => {
      for (const { value } of BAD_IDS) {
        for (const record of [
          guardRecord({ tenantA: value as string | undefined }),
          guardRecord({ tenantB: value as string | undefined }),
          // Even with a skipped probe (normally "inconclusive"), a bad id
          // must still be a hard denial.
          guardRecord({ tenantA: value as string | undefined, membershipA: "skipped" }),
        ]) {
          expect(evaluateTenantAccess(record).verdict).toBe("denied");
        }
      }
    });

    it("allows only the fully valid pair, whitespace tolerated after trimming", () => {
      expect(evaluateTenantAccess(guardRecord({})).verdict).toBe("allowed");
      expect(
        evaluateTenantAccess(guardRecord({ tenantA: VALID_A.toUpperCase() })).verdict,
      ).toBe("allowed");
    });
  });

  describe("report rendering", () => {
    it("never renders a bad identifier pair as a clean pass", () => {
      for (const { label, value } of BAD_IDS) {
        const record = guardRecord({ tenantA: value as string | undefined });
        const html = renderTenantGuardSection([record]);
        expect(evaluateTenantAccess(record).verdict, label).toBe("denied");
        // A denied pair must never present itself with only success badges.
        expect(html.includes("guard-bad") || html.includes("—") || html.includes("(missing)"), label)
          .toBe(true);
      }
    });

    it("escapes hostile identifier text instead of rendering markup", () => {
      const html = renderTenantGuardSection([
        guardRecord({ tenantA: "<script>alert(1)</script>" }),
      ]);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });
});
