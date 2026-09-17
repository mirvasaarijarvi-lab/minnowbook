/**
 * Query-path coverage for the rls-report failure renderer.
 *
 * The cross-tenant suites hit the database through many shapes: list reads,
 * detail reads by id, embedded joins, counts, paginated ranges, searches,
 * RPCs, storage list/download and every write verb. Each shape must survive
 * the whole pipeline — real assertion helper -> report parser -> HTML rows —
 * with its table, operation, attempted query and tenant pair intact.
 *
 * Fully offline: no database, no network. The failure text comes from the
 * real `rls-assert` helpers so this test cannot drift from production format.
 */
import { describe, expect, it } from "vitest";
import {
  expectNoForeignTenantRows,
  expectReadDenied,
  expectWriteDenied,
  type DenialResult,
  type QueryContext,
} from "./rls-assert";
import { parseRlsFailure, renderRlsDetails } from "./rls-report-reporter";
import {
  ACTING_TENANT,
  QUERY_PATH_MATRIX,
  TARGET_TENANT,
  type QueryPathCase,
} from "./fixtures/tenant-access-matrix";

function contextOf(c: QueryPathCase): QueryContext {
  return {
    table: c.table,
    // The suites pass descriptive operation labels ("SELECT (detail, single)",
    // "STORAGE LIST") so the report names the exact query path; the field is
    // only ever interpolated into text.
    operation: c.operation as QueryContext["operation"],
    attemptedQuery: c.attemptedQuery,
    actingTenantId: ACTING_TENANT,
    targetTenantId: TARGET_TENANT,
    scenario: c.scenario,
  };
}

/** Run the case's real assertion helper against a leaking result. */
function runLeak(c: QueryPathCase): void {
  const ctx = contextOf(c);
  const result = { data: c.leakedRows, error: null };
  if (c.kind === "write") expectWriteDenied(ctx, result);
  else if (c.kind === "scan")
    expectNoForeignTenantRows(ctx, result, c.forbiddenTenantId ?? TARGET_TENANT);
  else expectReadDenied(ctx, result);
}

/** Run the same helper against a properly denied result. */
function runDenied(c: QueryPathCase): void {
  const ctx = contextOf(c);
  const denied: DenialResult = {
    data: [],
    error:
      c.kind === "scan"
        ? null
        : ({
            code: "42501",
            message: "permission denied",
            details: "",
            hint: "",
            name: "PostgrestError",
          } as unknown as DenialResult["error"]),
  };
  if (c.kind === "write") expectWriteDenied(ctx, denied);
  else if (c.kind === "scan")
    expectNoForeignTenantRows(ctx, denied, c.forbiddenTenantId ?? TARGET_TENANT);
  else expectReadDenied(ctx, denied);
}

function messageOf(c: QueryPathCase): string {
  try {
    runLeak(c);
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error(`Case "${c.label}" did not fail on a leaking result`);
}

describe("rls-report query-path matrix", () => {
  it("covers list, detail, count, search, rpc, storage, write and scan paths", () => {
    const ops = QUERY_PATH_MATRIX.map((c) => c.operation.toLowerCase()).join(" | ");
    for (const needle of [
      "select (list)",
      "detail, single",
      "detail, maybesingle",
      "embedded join",
      "count, head",
      "search",
      "rpc",
      "storage list",
      "storage download",
      "insert",
      "update",
      "upsert",
      "delete",
      "broad scan",
      "range",
    ]) {
      expect(ops, `missing query path: ${needle}`).toContain(needle);
    }
    expect(new Set(QUERY_PATH_MATRIX.map((c) => c.label)).size).toBe(QUERY_PATH_MATRIX.length);
  });

  it.each(QUERY_PATH_MATRIX.map((c) => [c.label, c] as const))(
    "allows the denied outcome without a failure: %s",
    (_label, c) => {
      expect(() => runDenied(c)).not.toThrow();
    },
  );

  describe.each(QUERY_PATH_MATRIX.map((c) => [c.label, c] as const))("%s", (_label, c) => {
    it("fails on a leak and parses every field", () => {
      const details = parseRlsFailure(messageOf(c));
      expect(details).not.toBeNull();
      expect(details!.table).toBe(c.table);
      expect(details!.operation).toBe(c.operation);
      expect(details!.attemptedQuery).toBe(c.attemptedQuery);
      expect(details!.actingTenant).toBe(ACTING_TENANT);
      expect(details!.targetTenant).toBe(TARGET_TENANT);
      expect(details!.reason && details!.reason.length).toBeGreaterThan(0);
      expect(details!.returnedRows).toContain(TARGET_TENANT);
      if (c.scenario) expect(details!.scenario).toBe(c.scenario);
    });

    it("renders the path into the report HTML", () => {
      const html = renderRlsDetails(parseRlsFailure(messageOf(c))!);
      const escape = (v: string) =>
        v
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      expect(html).toContain(escape(c.table));
      expect(html).toContain(escape(c.operation));
      expect(html).toContain(escape(c.attemptedQuery));
      expect(html).toContain(ACTING_TENANT);
      expect(html).toContain(TARGET_TENANT);
      expect(html).toContain("Reason");
      // A leak must never render as an empty, reassuring block.
      expect(html).not.toBe(`<div class="rls-details"></div>`);
    });
  });

  it("never reports a raw, unparsed message for any covered path", () => {
    for (const c of QUERY_PATH_MATRIX) {
      const msg = messageOf(c);
      expect(msg).toContain("RLS DENIAL FAILED:");
      expect(parseRlsFailure(msg), `unparsed: ${c.label}`).not.toBeNull();
    }
  });

  it("ignores unrelated failure messages", () => {
    expect(parseRlsFailure("expect(received).toBe(expected)")).toBeNull();
    expect(parseRlsFailure(null)).toBeNull();
  });
});
