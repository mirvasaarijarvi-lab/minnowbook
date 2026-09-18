/**
 * Allow-path matrix: every rls-report query path, aimed at own data.
 *
 * The deny matrix proves foreign data stays out. This suite proves the other
 * half: for each of the same query paths, an own-tenant request returns only
 * the acting tenant's rows, is reported as a pass, and neither the response
 * nor the exported/rendered report carries another tenant's metadata.
 *
 * Every path is exercised through the real `rls-assert` helpers and the real
 * reporter, so expectations cannot drift from what the suites and the report
 * actually do.
 *
 * Fully offline: no database, no network.
 */
import { describe, expect, it } from "vitest";
import {
  ACTING_TENANT,
  ALLOW_PATH_MATRIX,
  QUERY_PATH_MATRIX,
  TARGET_TENANT,
  type AllowPathCase,
} from "./fixtures/tenant-access-matrix";
import {
  expectNoForeignTenantRows,
  type DenialResult,
  type QueryContext,
} from "./rls-assert";
import { applyReportGuard } from "./fixtures/report-render-guard";
import {
  parseRlsFailure,
  renderHtml,
  type ReportEntry,
  type ReportPayload,
} from "./rls-report-reporter";
import type { TenantGuardRecord } from "./fixtures/tenant-guard-record";

/** Foreign values that must never appear anywhere on an allow path. */
const FOREIGN_METADATA = [
  TARGET_TENANT,
  "99999999-9999-4999-8999-999999999999",
  "Foreign Guest",
  "foreign@example.test",
  "Foreign Sauna",
  "tok_foreign",
  "offer.pdf",
];

function ctxFor(c: AllowPathCase): QueryContext {
  return {
    table: c.table,
    operation: c.kind === "write" ? "UPDATE" : "SELECT",
    attemptedQuery: c.attemptedQuery,
    actingTenantId: ACTING_TENANT,
    scenario: c.scenario ?? `own-tenant ${c.kind} on ${c.table}`,
  };
}

const guardRecord: TenantGuardRecord = {
  suite: "cross-tenant RLS",
  recordedAt: "2026-01-01T00:00:00.000Z",
  tenantA: ACTING_TENANT,
  tenantB: TARGET_TENANT,
  membershipA: true,
  membershipB: true,
  emailA: "a@example.test",
  emailB: "b@example.test",
  membershipRowA: {
    role: "owner",
    isApproved: true,
    userId: "u-a",
    found: true,
  },
  membershipRowB: {
    role: "owner",
    isApproved: true,
    userId: "u-b",
    found: true,
  },
};

function entryFor(name: string, errorMessage: string | null): ReportEntry {
  return {
    file: "cross-tenant-rls.test.ts",
    suite: "cross-tenant RLS",
    name,
    fullName: `cross-tenant RLS > ${name}`,
    status: errorMessage ? "failed" : "passed",
    durationMs: 8,
    errorMessage,
    errorStack: null,
    rlsDetails: parseRlsFailure(errorMessage),
  };
}

function payloadFor(entries: ReportEntry[]): ReportPayload {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    flavor: "verify-core",
    totals: {
      total: entries.length,
      passed: entries.filter((e) => e.status === "passed").length,
      failed: entries.filter((e) => e.status === "failed").length,
      skipped: 0,
      durationMs: 8,
    },
    tenantGuard: [guardRecord],
    entries,
  };
}

const tenantIdsIn = (rows: Array<Record<string, unknown>>): string[] =>
  rows.flatMap((row) => {
    const own = typeof row.tenant_id === "string" ? [row.tenant_id] : [];
    const nested = Object.values(row).flatMap((value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? tenantIdsIn([value as Record<string, unknown>])
        : [],
    );
    return [...own, ...nested];
  });

describe("allow-path matrix: own-tenant query paths", () => {
  it("covers every query path in the deny matrix exactly once", () => {
    expect(ALLOW_PATH_MATRIX).toHaveLength(QUERY_PATH_MATRIX.length);
    expect(ALLOW_PATH_MATRIX.map((c) => c.label)).toEqual(
      QUERY_PATH_MATRIX.map((c) => c.label),
    );
    expect(new Set(ALLOW_PATH_MATRIX.map((c) => c.label)).size).toBe(
      ALLOW_PATH_MATRIX.length,
    );
    expect(new Set(ALLOW_PATH_MATRIX.map((c) => c.kind))).toEqual(
      new Set(QUERY_PATH_MATRIX.map((c) => c.kind)),
    );
  });

  describe.each(ALLOW_PATH_MATRIX.map((c) => [c.label, c] as const))(
    "%s",
    (_label, c) => {
      const result: DenialResult = { data: c.ownRows, error: null };

      it("returns only rows carrying the acting tenant id", () => {
        const ids = tenantIdsIn(c.ownRows);
        expect(ids.length).toBeGreaterThanOrEqual(c.minRows > 0 ? 1 : 0);
        for (const id of ids) expect(id).toBe(ACTING_TENANT);
        expect(c.ownRows).toHaveLength(c.minRows);
      });

      it("carries no other tenant's metadata", () => {
        const json =
          JSON.stringify(c.ownRows) + c.attemptedQuery + (c.scenario ?? "");
        for (const value of FOREIGN_METADATA) expect(json).not.toContain(value);
      });

      it("passes the foreign-row guard used by the suites", () => {
        expect(() =>
          expectNoForeignTenantRows(ctxFor(c), result, TARGET_TENANT),
        ).not.toThrow();
      });

      it("still catches a foreign row that sneaks into the same response", () => {
        const polluted: DenialResult = {
          data: [
            ...c.ownRows,
            { id: "x", tenant_id: TARGET_TENANT, guest_name: "Foreign Guest" },
          ],
          error: null,
        };
        expect(() =>
          expectNoForeignTenantRows(ctxFor(c), polluted, TARGET_TENANT),
        ).toThrow(/RLS DENIAL FAILED/);
      });

      it("is reported as a pass with no failure details", () => {
        const payload = payloadFor([entryFor(c.label, null)]);
        const guarded = applyReportGuard(payload);
        expect(guarded.denied).toBe(false);
        const entry = guarded.payload.entries[0];
        expect(entry.status).toBe("passed");
        expect(entry.rlsDetails).toBeNull();
        expect(entry.errorMessage).toBeNull();

        const html = renderHtml(guarded.payload);
        expect(html).not.toContain("RLS DENIAL FAILED");
        expect(html).not.toContain("Returned rows");
        expect(html).toContain(
          c.label.replace(/&/g, "&amp;").replace(/'/g, "&#39;"),
        );
      });
    },
  );

  describe("the whole allow run", () => {
    const payload = payloadFor(
      ALLOW_PATH_MATRIX.map((c) => entryFor(c.label, null)),
    );

    it("reports every path as passed", () => {
      expect(payload.totals.passed).toBe(ALLOW_PATH_MATRIX.length);
      expect(payload.totals.failed).toBe(0);
    });

    it("exports no other tenant's metadata", () => {
      const json = JSON.stringify(applyReportGuard(payload).payload);
      for (const value of FOREIGN_METADATA) {
        if (value === TARGET_TENANT) continue; // the guard section legitimately lists the pair ids
        expect(json).not.toContain(value);
      }
      expect(json).not.toContain('rlsDetails":{');
    });

    it("shows only ids, roles and flags for the tenant pair", () => {
      const html = renderHtml(payload);
      expect(html).toContain(ACTING_TENANT);
      expect(html).toContain("probe ✓");
      for (const value of FOREIGN_METADATA) {
        if (value === TARGET_TENANT) continue;
        expect(html).not.toContain(value);
      }
      expect(html).not.toContain('<div class="rls-details"');
    });

    it("keeps every own-tenant row scoped to the acting tenant", () => {
      const allIds = ALLOW_PATH_MATRIX.flatMap((c) => tenantIdsIn(c.ownRows));
      expect(allIds.length).toBeGreaterThan(ALLOW_PATH_MATRIX.length);
      expect(new Set(allIds)).toEqual(new Set([ACTING_TENANT]));
    });
  });
});
