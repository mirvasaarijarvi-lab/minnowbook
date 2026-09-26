/**
 * Real Excel (.xlsx) payroll workbook: one sheet of day rows and one sheet of
 * per-worker totals. Numbers stay numeric; text cells are guarded against
 * formula injection like the CSV export.
 */
import type ExcelJSType from "exceljs";
import {
  payrollDayHeaders,
  payrollDayValues,
  payrollSummaryHeaders,
  payrollSummaryValues,
  sanitizeCsvCell,
  type PayrollDayRow,
  type PayrollLang,
  type PayrollSummaryRow,
} from "./shiftPayroll";

const SHEET_NAMES: Record<PayrollLang, { days: string; summary: string }> = {
  en: { days: "Payroll days", summary: "Payroll summary" },
  fi: { days: "Palkkapäivät", summary: "Palkkayhteenveto" },
  sv: { days: "Lönedagar", summary: "Lönesammanfattning" },
};

const HOUR_FORMAT = "0.00";

function addSheet(
  wb: ExcelJSType.Workbook,
  name: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  for (const r of rows)
    ws.addRow(
      r.map((c) =>
        typeof c === "number" ? c : c === "" ? null : sanitizeCsvCell(c),
      ),
    );
  ws.columns.forEach((col, i) => {
    const values = [headers[i], ...rows.map((r) => r[i])];
    col.width = Math.min(
      40,
      Math.max(8, ...values.map((v) => String(v ?? "").length + 2)),
    );
    if (rows.some((r) => typeof r[i] === "number")) col.numFmt = HOUR_FORMAT;
  });
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  return ws;
}

export async function buildPayrollWorkbook(
  days: PayrollDayRow[],
  summary: PayrollSummaryRow[],
  lang: PayrollLang,
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "MimmoBook";
  wb.created = new Date();
  const names = SHEET_NAMES[lang];
  addSheet(
    wb,
    names.days,
    payrollDayHeaders(lang),
    days.map((r) => payrollDayValues(r, lang)),
  );
  addSheet(
    wb,
    names.summary,
    payrollSummaryHeaders(lang),
    summary.map(payrollSummaryValues),
  );
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
