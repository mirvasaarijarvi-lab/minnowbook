import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";

/**
 * Regression: the downloaded Payroll Excel file contains only shifts from the
 * selected location's shift lists plus the all-locations lists. Runs the same
 * steps as the Payroll Excel button (fetch by date, build, write .xlsx), then
 * opens the file and reads back every worker row on both sheets.
 * A stand-in database applies the same filters PostgREST would.
 */
const T = "tenant-1";
const DAY = "2026-10-05";
const mk = (id: string, site: string | null, tenant = T) => ({
  tenant_id: tenant,
  date: DAY,
  start_time: "10:00:00",
  end_time: "18:00:00",
  actual_start_time: null,
  actual_end_time: null,
  actual_note: null,
  code: null,
  shift_slots: {
    id,
    staff_member_id: `m-${id}`,
    role_key: "waiter",
    shift_periods: { site_id: site },
  },
});

let rows: ReturnType<typeof mk>[] = [];

function builder() {
  const eqs: [string, string][] = [];
  const ranges: [string, string, string][] = [];
  let orFilter: string | null = null;
  const b: any = {
    select: () => b,
    order: () => b,
    eq: (c: string, v: string) => (eqs.push([c, v]), b),
    gte: (c: string, v: string) => (ranges.push([c, ">=", v]), b),
    lte: (c: string, v: string) => (ranges.push([c, "<=", v]), b),
    or: (f: string, o: any) => {
      expect(o?.referencedTable).toBe("shift_slots.shift_periods");
      orFilter = f;
      return b;
    },
    then: (res: any) => {
      let out = rows.filter((r) => eqs.every(([c, v]) => (r as any)[c] === v));
      out = out.filter((r) =>
        ranges.every(([c, op, v]) =>
          op === ">=" ? (r as any)[c] >= v : (r as any)[c] <= v,
        ),
      );
      if (orFilter) {
        const parts = orFilter.split(",");
        out = out.filter((r) => {
          const s = r.shift_slots.shift_periods.site_id;
          return parts.some((p) =>
            p === "site_id.is.null" ? s === null : p === `site_id.eq.${s}`,
          );
        });
      }
      return Promise.resolve({ data: out, error: null }).then(res);
    },
  };
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => builder() },
}));

const NAMES: Record<string, string> = {
  "m-a": "Anna Location A",
  "m-b": "Bertil Location B",
  "m-all": "Cecilia All locations",
  "m-other": "Other Business",
};

/** Build the file like the Payroll Excel button, then open it. */
async function downloadAndOpen(siteId: string | null) {
  const { fetchPayrollRange } = await import("@/hooks/useShiftList");
  const { buildPayroll } = await import("./shiftPayroll");
  const { buildPayrollWorkbook } = await import("./shiftPayrollXlsx");
  const groups = await fetchPayrollRange(T, DAY, DAY, siteId);
  const { days, summary } = buildPayroll(
    groups.map((g) => ({
      worker: NAMES[g.staff_member_id ?? ""] ?? "?",
      role: "Waiter",
      shifts: g.shifts,
    })) as any,
  );
  const buf = await buildPayrollWorkbook(days, summary, "en");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const workersOn = (i: number) => {
    const out: string[] = [];
    wb.worksheets[i].eachRow((row, n) => {
      if (n > 1) out.push(String(row.getCell(i === 0 ? 2 : 1).value));
    });
    return out.sort();
  };
  return { days: workersOn(0), summary: workersOn(1) };
}

beforeEach(() => {
  rows = [
    mk("a", "site-A"),
    mk("b", "site-B"),
    mk("all", null),
    mk("other", "site-A", "tenant-2"),
  ];
});

describe("Payroll Excel file: location scope", () => {
  it("location A: only A's and all-locations shifts in both sheets", async () => {
    const f = await downloadAndOpen("site-A");
    const want = ["Anna Location A", "Cecilia All locations"];
    expect(f.days).toEqual(want);
    expect(f.summary).toEqual(want);
  });

  it("location B: only B's and all-locations shifts in both sheets", async () => {
    const f = await downloadAndOpen("site-B");
    const want = ["Bertil Location B", "Cecilia All locations"];
    expect(f.days).toEqual(want);
    expect(f.summary).toEqual(want);
  });

  it("no location picked: every list of the business, never another business", async () => {
    const f = await downloadAndOpen(null);
    const want = [
      "Anna Location A",
      "Bertil Location B",
      "Cecilia All locations",
    ];
    expect(f.days).toEqual(want);
    expect(f.summary).toEqual(want);
  });
});
