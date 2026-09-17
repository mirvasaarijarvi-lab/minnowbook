/**
 * Deny-case leak audit for the rls-report.
 *
 * A denied cross-tenant query must be boring: zero rows returned, no failure
 * message, no failure detail block, and absolutely no foreign-tenant metadata
 * anywhere in the JSON artifact or the HTML dashboard (which gets uploaded as
 * a CI artifact and can be shared far more widely than the database itself).
 *
 * Every deny path from the query-path matrix is exercised through the real
 * `rls-assert` helpers and the real report renderer. Fully offline.
 */
import { describe, expect, it } from "vitest";
import {
  expectNoForeignTenantRows,
  expectReadDenied,
  expectWriteDenied,
  type DenialResult,
  type QueryContext,
} from "./rls-assert";
import {
  parseRlsFailure,
  renderHtml,
  renderTenantGuardSection,
  type ReportEntry,
  type ReportPayload,
} from "./rls-report-reporter";
import {
  ACTING_TENANT,
  QUERY_PATH_MATRIX,
  TARGET_TENANT,
  type QueryPathCase,
} from "./fixtures/tenant-access-matrix";
import type { TenantGuardRecord } from "./fixtures/tenant-guard-record";

const permissionDenied = {
  code: "42501",
  message: "permission denied for table",
  details: "",
  hint: "",
  name: "PostgrestError",
} as unknown as DenialResult["error"];

function contextOf(c: QueryPathCase): QueryContext {
  return {
    table: c.table,
    operation: c.operation as QueryContext["operation"],
    attemptedQuery: c.attemptedQuery,
    actingTenantId: ACTING_TENANT,
    targetTenantId: TARGET_TENANT,
    scenario: c.scenario,
  };
}

/**
 * The two shapes a correct denial takes in practice: an explicit Postgres
 * error, or a silent empty result (RLS filtered every row out).
 */
function deniedResults(c: QueryPathCase): Array<{ label: string; result: DenialResult }> {
  const shapes: Array<{ label: string; result: DenialResult }> = [
    { label: "empty result", result: { data: [], error: null } },
    { label: "null data", result: { data: null, error: null } },
  ];
  // A broad-scan check treats an unexpected error as a failure by design, so
  // only the row-free shapes count as denial there.
  if (c.kind !== "scan") {
    shapes.push({ label: "permission denied error", result: { data: [], error: permissionDenied } });
    shapes.push({ label: "error with null data", result: { data: null, error: permissionDenied } });
  }
  return shapes;
}

function assertDenied(c: QueryPathCase, result: DenialResult): void {
  const ctx = contextOf(c);
  if (c.kind === "write") expectWriteDenied(ctx, result);
  else if (c.kind === "scan")
    expectNoForeignTenantRows(ctx, result, c.forbiddenTenantId ?? TARGET_TENANT);
  else expectReadDenied(ctx, result);
}

/** Every value a leaking database would have exposed for this case. */
function forbiddenStrings(c: QueryPathCase): string[] {
  const out = new Set<string>([TARGET_TENANT]);
  const walk = (value: unknown) => {
    if (typeof value === "string") out.add(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  c.leakedRows.forEach(walk);
  return [...out].filter((v) => v.length > 3);
}

function passedEntry(c: QueryPathCase, shapeLabel: string): ReportEntry {
  return {
    file: "src/test/security/cross-tenant-rls.test.ts",
    suite: "cross-tenant RLS",
    // Test names never carry tenant ids or row values, only the query path.
    name: `denies ${c.operation} (${shapeLabel})`,
    fullName: `cross-tenant RLS > denies ${c.operation}`,
    status: "passed",
    durationMs: 12,
    errorMessage: null,
    errorStack: null,
    rlsDetails: null,
  };
}

function payloadOf(entries: ReportEntry[], tenantGuard: TenantGuardRecord[] = []): ReportPayload {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    flavor: "deny-audit",
    totals: {
      total: entries.length,
      passed: entries.filter((e) => e.status === "passed").length,
      failed: entries.filter((e) => e.status === "failed").length,
      skipped: entries.filter((e) => e.status === "skipped").length,
      durationMs: 100,
    },
    tenantGuard,
    entries,
  };
}

describe("rls-report deny cases return zero rows and leak no tenant metadata", () => {
  describe.each(QUERY_PATH_MATRIX.map((c) => [c.label, c] as const))("%s", (_label, c) => {
    it.each(deniedResults(c).map((s) => [s.label, s.result] as const))(
      "accepts the denial and reports zero rows: %s",
      (_shape, result) => {
        expect(() => assertDenied(c, result)).not.toThrow();
        expect(result.data ?? []).toHaveLength(0);
      },
    );

    it("produces no failure message and no failure detail block", () => {
      for (const { label, result } of deniedResults(c)) {
        let message: string | null = null;
        try {
          assertDenied(c, result);
        } catch (err) {
          message = (err as Error).message;
        }
        expect(message, `denial "${label}" must not fail`).toBeNull();
        expect(parseRlsFailure(message)).toBeNull();
      }
    });

    it("keeps every foreign value out of the JSON artifact and the HTML report", () => {
      const entries = deniedResults(c).map((s) => passedEntry(c, s.label));
      const payload = payloadOf(entries);
      const json = JSON.stringify(payload);
      const html = renderHtml(payload);
      for (const secret of forbiddenStrings(c)) {
        expect(json, `JSON leaks "${secret}"`).not.toContain(secret);
        expect(html, `HTML leaks "${secret}"`).not.toContain(secret);
      }
      expect(html).not.toContain(`<div class="rls-details"`);
      expect(html).not.toContain("Returned rows");
      expect(html).not.toContain("Attempted query");
      expect(html).not.toContain(ACTING_TENANT);
    });
  });

  it("renders an all-passed report with no failure sections at all", () => {
    const entries = QUERY_PATH_MATRIX.map((c) => passedEntry(c, "empty result"));
    const payload = payloadOf(entries);
    const html = renderHtml(payload);
    expect(html).not.toContain(`<div class="rls-details"`);
    expect(payload.entries.every((e) => e.errorMessage === null && e.rlsDetails === null)).toBe(
      true,
    );
    const allSecrets = QUERY_PATH_MATRIX.flatMap(forbiddenStrings);
    for (const secret of new Set(allSecrets)) {
      expect(html, `HTML leaks "${secret}"`).not.toContain(secret);
    }
  });

  it("guard section for a clean pair exposes only ids, roles and flags", () => {
    const record: TenantGuardRecord = {
      suite: "cross-tenant RLS",
      tenantA: ACTING_TENANT,
      tenantB: TARGET_TENANT,
      recordedAt: "2026-01-01T00:00:00.000Z",
      membershipA: true,
      membershipB: true,
      membershipRowA: { role: "owner", isApproved: true, found: true },
      membershipRowB: { role: "owner", isApproved: true, found: true },
    };
    const html = renderTenantGuardSection([record]);
    // Tenant ids are the guard's whole point; row data never is.
    for (const secret of new Set(QUERY_PATH_MATRIX.flatMap(forbiddenStrings))) {
      if (secret === TARGET_TENANT) continue;
      expect(html, `guard section leaks "${secret}"`).not.toContain(secret);
    }
    expect(html).not.toContain("Returned rows");
    expect(html).not.toContain("Attempted query");
  });

  it("a denial that arrives as an error never carries row data forward", () => {
    for (const c of QUERY_PATH_MATRIX.filter((x) => x.kind !== "scan")) {
      const result: DenialResult = { data: [], error: permissionDenied };
      expect(() => assertDenied(c, result)).not.toThrow();
      expect(JSON.stringify(result)).not.toContain(TARGET_TENANT);
    }
  });
});
