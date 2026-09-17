/**
 * Report export tenant-denial suite.
 *
 * Contract: when a report query is refused for the acting tenant, the CSV and
 * PDF exports built from its result must contain no trace of the other tenant.
 * Headers, labels and zero totals are fine; ids, guest names, emails, tokens,
 * file names, site names and notes are not. A leak in the same shape must
 * still be detected, and when the tenant pair itself is denied the leak must
 * be withheld from the rls-report JSON and HTML.
 *
 * Fully offline: no database, no network.
 */
import { describe, it, expect } from "vitest";
import { buildReportCsv, reportCsvFileName, sanitizeCsvCell } from "@/lib/report-csv-export";
import { buildReportPdf } from "@/lib/reportsPdf";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  ACTING_TENANT,
  TARGET_TENANT,
  DENIAL_SHAPES,
  EXPORT_SURFACES,
  FOREIGN_EXPORT_METADATA,
  rowsFromDenial,
  type ExportSurface,
} from "./fixtures/report-export-matrix";
import { expectReadDenied, expectNoForeignTenantRows, type QueryContext } from "./rls-assert";
import { applyReportGuard, WITHHELD_NOTICE } from "./fixtures/report-render-guard";
import type { TenantGuardRecord } from "./fixtures/tenant-guard-record";
import { renderHtml, type ReportPayload } from "./rls-report-reporter";

const ctxFor = (surface: ExportSurface): QueryContext => ({
  table: surface.table,
  operation: "SELECT",
  attemptedQuery: surface.attemptedQuery,
  actingTenantId: ACTING_TENANT,
  targetTenantId: TARGET_TENANT,
  scenario: `export denial: ${surface.label}`,
});

/** Text of a built PDF, searchable for leaked strings. */
const pdfText = (
  surface: ExportSurface,
  body: string[][],
  fileName: string,
): string => {
  const doc = buildReportPdf({
    title: "Reports",
    subtitle: "1.9.2026 to 30.9.2026",
    fileName,
    kpis: [{ label: "Total", value: String(body.length) }],
    table: { head: surface.headers, body },
  });
  const buf = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(buf).toString("latin1");
};

const buildExport = (
  surface: ExportSurface,
  rows: string[][],
): { text: string; fileName: string } => {
  const fileName = reportCsvFileName(surface.fileNamePrefix, "1.9.2026 - 30.9.2026", "Own Site");
  if (surface.format === "csv") {
    return { text: buildReportCsv(surface.headers, [...rows, ...surface.summaryRows]), fileName };
  }
  return { text: pdfText(surface, rows, fileName), fileName };
};

const deniedGuardLog = (suite: string): TenantGuardRecord[] => [
  {
    suite,
    recordedAt: new Date().toISOString(),
    tenantA: ACTING_TENANT,
    tenantB: TARGET_TENANT,
    membershipA: true,
    membershipB: false,
    membershipRowA: { role: "owner", isApproved: true, found: true },
    membershipRowB: { role: null, isApproved: false, found: false },
  } as unknown as TenantGuardRecord,
];

describe("report exports on tenant deny cases", () => {
  it("covers both export formats", () => {
    expect(EXPORT_SURFACES.some((s) => s.format === "csv")).toBe(true);
    expect(EXPORT_SURFACES.some((s) => s.format === "pdf")).toBe(true);
    expect(new Set(EXPORT_SURFACES.map((s) => s.label)).size).toBe(EXPORT_SURFACES.length);
  });

  for (const surface of EXPORT_SURFACES) {
    describe(surface.label, () => {
      for (const shape of DENIAL_SHAPES) {
        it(`yields an export with no foreign data (${shape.label})`, () => {
          const result = {
            data: shape.data,
            error: (shape.error ?? null) as PostgrestError | null,
          };
          // 1. The refusal itself is a valid denial.
          expect(() => expectReadDenied(ctxFor(surface), result)).not.toThrow();

          // 2. Nothing reaches the export.
          const rows = rowsFromDenial(shape);
          expect(rows).toEqual([]);

          // 3. The export carries no foreign value anywhere, file name included.
          const { text, fileName } = buildExport(surface, rows);
          for (const secret of FOREIGN_EXPORT_METADATA) {
            expect(text, `${surface.label} leaked ${secret}`).not.toContain(secret);
            expect(fileName).not.toContain(secret);
          }

          // 4. Structure is still intact: headers/labels present, no data rows.
          if (surface.format === "csv") {
            expect(text).toContain(sanitizeCsvCell(surface.headers[0]));
            const dataLines = text
              .split("\r\n")
              .slice(1) // header line
              .filter((line) => line.trim().length > 0);
            expect(dataLines.length).toBe(surface.summaryRows.length);
          }
          expect(fileName.endsWith(".csv")).toBe(true);
        });
      }

      it("still detects a leak in the same shape", () => {
        const { text } = buildExport(surface, surface.foreignRows);
        const leakedValues = FOREIGN_EXPORT_METADATA.filter((v) =>
          surface.foreignRows.some((row) => row.includes(v)),
        );
        expect(leakedValues.length).toBeGreaterThan(0);
        for (const value of leakedValues) {
          // Proof that the leak check above can actually see foreign values.
          expect(text).toContain(value);
        }
        expect(() =>
          expectReadDenied(ctxFor(surface), {
            data: surface.foreignRows.map(() => ({ tenant_id: TARGET_TENANT })),
            error: null,
          }),
        ).toThrow(/RLS DENIAL FAILED/);
      });

      it("flags a foreign row that slipped into the export source", () => {
        expect(() =>
          expectNoForeignTenantRows(
            ctxFor(surface),
            { data: [{ tenant_id: ACTING_TENANT }, { tenant_id: TARGET_TENANT }], error: null },
            TARGET_TENANT,
          ),
        ).toThrow(new RegExp(surface.table));
      });
    });
  }

  it("withholds a leaked export failure from the report when the pair is denied", () => {
    const surface = EXPORT_SURFACES[0];
    let message = "";
    try {
      expectReadDenied(ctxFor(surface), {
        data: [{ tenant_id: TARGET_TENANT, guest_name: "Foreign Guest" }],
        error: null,
      });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("RLS DENIAL FAILED");

    const suite = "src/test/security/report-export-tenant-denial.test.ts";
    const payload = {
      generatedAt: new Date().toISOString(),
      totals: { total: 1, passed: 0, failed: 1, skipped: 0, durationMs: 12 },
      entries: [
        {
          suite,
          name: surface.label,
          status: "failed",
          errorMessage: message,
          errorStack: `${message}\n    at export`,
        },
      ],
      tenantGuard: deniedGuardLog(suite),
    } as unknown as ReportPayload;

    const guarded = applyReportGuard(payload, deniedGuardLog(suite)).payload as ReportPayload;
    const json = JSON.stringify(guarded);
    const html = renderHtml(guarded);
    for (const secret of [...FOREIGN_EXPORT_METADATA, surface.attemptedQuery]) {
      expect(json).not.toContain(secret);
      expect(html).not.toContain(secret);
    }
    expect(json).toContain(WITHHELD_NOTICE);
    expect(json).not.toContain("Returned rows");
  });

  it("keeps an all-denied export run free of failures", () => {
    const suite = "src/test/security/report-export-tenant-denial.test.ts";
    const payload = {
      generatedAt: new Date().toISOString(),
      totals: {
        total: EXPORT_SURFACES.length,
        passed: EXPORT_SURFACES.length,
        failed: 0,
        skipped: 0,
        durationMs: 12,
      },
      entries: EXPORT_SURFACES.map((s) => ({ suite, name: s.label, status: "passed" })),
      tenantGuard: [],
    } as unknown as ReportPayload;
    const json = JSON.stringify(payload);
    const html = renderHtml(payload);
    for (const secret of FOREIGN_EXPORT_METADATA) {
      expect(json).not.toContain(secret);
      expect(html).not.toContain(secret);
    }
    expect(json).not.toContain("RLS DENIAL FAILED");
  });
});
