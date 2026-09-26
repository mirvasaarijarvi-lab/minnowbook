import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildPayroll } from "./shiftPayroll";
import { buildPayrollWorkbook } from "./shiftPayrollXlsx";

const base = {
  code: null,
  actual_note: null,
  actual_start_time: null,
  actual_end_time: null,
};

async function load(lang: "en" | "fi" | "sv", worker = "Anna") {
  const { days, summary } = buildPayroll([
    {
      worker,
      role: "Cook",
      shifts: [
        {
          ...base,
          date: "2026-09-28",
          start_time: "10:00:00",
          end_time: "18:00:00",
          actual_start_time: "10:00:00",
          actual_end_time: "20:00:00",
        },
        {
          ...base,
          date: "2026-09-29",
          start_time: null,
          end_time: null,
          code: "V",
        },
      ],
    } as any,
  ]);
  const buf = await buildPayrollWorkbook(days, summary, lang);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

describe("buildPayrollWorkbook", () => {
  it("writes a real xlsx with day and summary sheets", async () => {
    const wb = await load("en");
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Payroll days",
      "Payroll summary",
    ]);
    const days = wb.worksheets[0];
    expect(days.getRow(1).font?.bold).toBe(true);
    expect(days.rowCount).toBe(3);
    expect(days.getRow(2).getCell(2).value).toBe("Anna");
  });

  it("keeps hours numeric so payroll can sum them", async () => {
    const wb = await load("en");
    const summary = wb.worksheets[1];
    expect(summary.getRow(2).getCell(3).value).toBe(8);
    expect(summary.getRow(2).getCell(4).value).toBe(10);
    expect(summary.getRow(2).getCell(8).value).toBe(1);
  });

  it("localizes sheet names", async () => {
    expect((await load("fi")).worksheets[0].name).toBe("Palkkapäivät");
    expect((await load("sv")).worksheets[1].name).toBe("Lönesammanfattning");
  });

  it("neutralizes formula injection in text cells", async () => {
    const wb = await load("en", '=HYPERLINK("x")');
    const v = wb.worksheets[0].getRow(2).getCell(2).value;
    expect(typeof v).toBe("string");
    expect(String(v).startsWith("=")).toBe(false);
  });
});
