/**
 * Tenant-denied users must not be able to change anything across tenants.
 *
 * For every mutation shape in `WRITE_DENIAL_MATRIX` (insert, update, upsert,
 * delete, write-capable RPC, plus the unfiltered variants that rely on RLS
 * alone) this suite checks:
 *
 *   - each of the three shapes a correct denial takes (error, empty result,
 *     no result) passes the real `expectWriteDenied` helper;
 *   - a write that actually succeeds fails loudly with full context;
 *   - a denied tenant pair never publishes those details: the guard withholds
 *     them from both the exported JSON and the rendered HTML;
 *   - no foreign tenant metadata appears in either output.
 *
 * Fully offline: no database, no network.
 */
import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  FOREIGN_WRITE_METADATA,
  WRITE_DENIAL_MATRIX,
  type WriteDenialCase,
} from "./fixtures/tenant-write-denial-matrix";
import {
  ACTING_TENANT,
  TARGET_TENANT,
  evaluateTenantAccess,
} from "./fixtures/tenant-access-matrix";
import {
  expectWriteDenied,
  type DenialResult,
  type QueryContext,
} from "./rls-assert";
import {
  applyReportGuard,
  WITHHELD_NOTICE,
} from "./fixtures/report-render-guard";
import {
  parseRlsFailure,
  renderHtml,
  type ReportEntry,
  type ReportPayload,
} from "./rls-report-reporter";
import type { TenantGuardRecord } from "./fixtures/tenant-guard-record";

const permissionDenied = {
  code: "42501",
  message: `permission denied for table`,
  details: null,
  hint: null,
  name: "PostgrestError",
  toJSON: () => ({}),
} as unknown as PostgrestError;

const rlsViolation = {
  code: "42501",
  message:
    'new row violates row-level security policy for table "reservations"',
  details: null,
  hint: null,
  name: "PostgrestError",
  toJSON: () => ({}),
} as unknown as PostgrestError;

/** The three shapes a correct write denial takes in practice. */
const DENIAL_SHAPES: Array<{ label: string; result: DenialResult }> = [
  {
    label: "permission denied error",
    result: { data: null, error: permissionDenied },
  },
  {
    label: "row-level security violation",
    result: { data: null, error: rlsViolation },
  },
  {
    label: "silent no-op: zero affected rows",
    result: { data: [], error: null },
  },
  {
    label: "silent no-op: no result at all",
    result: { data: undefined, error: null },
  },
];

function ctxFor(c: WriteDenialCase): QueryContext {
  return {
    table: c.table,
    operation: c.operation,
    attemptedQuery: c.attemptedQuery,
    actingTenantId: ACTING_TENANT,
    targetTenantId: c.unfiltered ? undefined : TARGET_TENANT,
    scenario: c.scenario ?? `denied user ${c.kind}s ${c.table} across tenants`,
  };
}

const deniedGuard: TenantGuardRecord = {
  suite: "cross-tenant RLS",
  recordedAt: new Date().toISOString(),
  tenantA: ACTING_TENANT,
  tenantB: TARGET_TENANT,
  membershipA: true,
  membershipB: false,
  membershipRowA: {
    role: "owner",
    isApproved: true,
    userId: "u-a",
    found: true,
  },
  membershipRowB: {
    role: "staff",
    isApproved: false,
    userId: "u-b",
    found: true,
  },
};

function payloadFor(
  entries: ReportEntry[],
  guard = deniedGuard,
): ReportPayload {
  return {
    generatedAt: new Date().toISOString(),
    flavor: "verify-core",
    totals: {
      total: entries.length,
      passed: entries.filter((e) => e.status === "passed").length,
      failed: entries.filter((e) => e.status === "failed").length,
      skipped: 0,
      durationMs: 12,
    },
    tenantGuard: [guard],
    entries,
  };
}

function entryFor(name: string, errorMessage: string | null): ReportEntry {
  return {
    file: "cross-tenant-rls.test.ts",
    suite: "cross-tenant RLS",
    name,
    fullName: `cross-tenant RLS > ${name}`,
    status: errorMessage ? "failed" : "passed",
    durationMs: 12,
    errorMessage,
    errorStack: errorMessage ? "Error\n  at write-denial" : null,
    rlsDetails: parseRlsFailure(errorMessage),
  };
}

function leakMessage(c: WriteDenialCase): string {
  try {
    expectWriteDenied(ctxFor(c), { data: c.leakedRows, error: null });
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error("expected the leaking write to throw");
}

describe("tenant-denied users cannot write across tenants", () => {
  it("covers create, update and delete on filtered and unfiltered paths", () => {
    const kinds = new Set(WRITE_DENIAL_MATRIX.map((c) => c.kind));
    expect(kinds).toEqual(
      new Set(["insert", "update", "delete", "upsert", "rpc"]),
    );
    const ops = new Set(WRITE_DENIAL_MATRIX.map((c) => c.operation));
    expect(ops).toEqual(new Set(["INSERT", "UPDATE", "DELETE"]));
    expect(WRITE_DENIAL_MATRIX.some((c) => c.unfiltered)).toBe(true);
    expect(
      WRITE_DENIAL_MATRIX.filter((c) => c.unfiltered).length,
    ).toBeGreaterThanOrEqual(5);
    expect(new Set(WRITE_DENIAL_MATRIX.map((c) => c.label)).size).toBe(
      WRITE_DENIAL_MATRIX.length,
    );
  });

  it("treats the acting pair as denied, so nothing it captures may be published", () => {
    const verdict = evaluateTenantAccess(deniedGuard);
    expect(verdict.verdict).toBe("denied");
  });

  describe.each(WRITE_DENIAL_MATRIX.map((c) => [c.label, c] as const))(
    "%s",
    (_label, c) => {
      it.each(DENIAL_SHAPES.map((s) => [s.label, s.result] as const))(
        "accepts denial via %s",
        (_shape, result) => {
          expect(() => expectWriteDenied(ctxFor(c), result)).not.toThrow();
        },
      );

      it("fails with full context when the write actually succeeds", () => {
        const message = leakMessage(c);
        expect(message).toContain("RLS DENIAL FAILED");
        expect(message).toContain(`Table:           ${c.table}`);
        expect(message).toContain(`Operation:       ${c.operation}`);
        expect(message).toContain(`Attempted query: ${c.attemptedQuery}`);
        expect(message).toContain(`Acting tenant:   ${ACTING_TENANT}`);
        expect(message).toContain("Returned rows:");
        expect(parseRlsFailure(message)).not.toBeNull();
      });

      it("withholds the leak details from the report for a denied pair", () => {
        const guarded = applyReportGuard(
          payloadFor([entryFor(c.label, leakMessage(c))]),
        );
        expect(guarded.denied).toBe(true);
        const entry = guarded.payload.entries[0];
        expect(entry.errorMessage).toBe(WITHHELD_NOTICE);
        expect(entry.errorStack).toBeNull();
        expect(entry.rlsDetails?.withheld).toBe(true);

        const json = JSON.stringify(guarded.payload);
        const html = renderHtml(guarded.payload);
        for (const value of FOREIGN_WRITE_METADATA) {
          if (value === TARGET_TENANT) continue; // guard section lists the pair ids only
          expect(json).not.toContain(value);
          expect(html).not.toContain(value);
        }
        expect(json).not.toContain(c.attemptedQuery);
        expect(html).not.toContain(c.attemptedQuery);
        expect(json).not.toContain("Returned rows");
        expect(html).not.toContain("Returned rows");
      });
    },
  );

  describe("a whole denied write run", () => {
    it("reports every mutation path as denied with nothing captured", () => {
      const entries = WRITE_DENIAL_MATRIX.map((c) => entryFor(c.label, null));
      const guarded = applyReportGuard(payloadFor(entries));
      expect(guarded.payload.totals.failed).toBe(0);
      const json = JSON.stringify(guarded.payload);
      for (const value of FOREIGN_WRITE_METADATA) {
        if (value === TARGET_TENANT) continue;
        expect(json).not.toContain(value);
      }
      expect(json).not.toContain("RLS DENIAL FAILED");
    });

    it("keeps every leak visible when the pair is allowed, so real bugs surface", () => {
      const allowedGuard: TenantGuardRecord = {
        ...deniedGuard,
        membershipB: true,
        membershipRowB: {
          role: "owner",
          isApproved: true,
          userId: "u-b",
          found: true,
        },
      };
      expect(evaluateTenantAccess(allowedGuard).verdict).toBe("allowed");
      const entries = WRITE_DENIAL_MATRIX.map((c) =>
        entryFor(c.label, leakMessage(c)),
      );
      const guarded = applyReportGuard(payloadFor(entries, allowedGuard));
      expect(guarded.denied).toBe(false);
      const html = renderHtml(guarded.payload);
      expect(html).toContain("RLS DENIAL FAILED");
      for (const c of WRITE_DENIAL_MATRIX) {
        expect(
          guarded.payload.entries.some(
            (e) => e.name === c.label && e.status === "failed",
          ),
        ).toBe(true);
      }
    });

    it("never counts a denial as a leak, in any shape, for any path", () => {
      for (const c of WRITE_DENIAL_MATRIX) {
        for (const shape of DENIAL_SHAPES) {
          expect(() =>
            expectWriteDenied(ctxFor(c), shape.result),
          ).not.toThrow();
        }
      }
    });
  });
});
