import { describe, it, expect } from "vitest";
import {
  buildPayroll,
  payrollDayValues,
  PAYROLL_DAY_HEADERS,
  toCsv,
} from "./shiftPayroll";

const base = {
  code: null,
  actual_note: null,
  actual_start_time: null,
  actual_end_time: null,
};

describe("buildPayroll", () => {
  it("uses realized hours when present, else planned, and flags missing", () => {
    const { days, summary } = buildPayroll([
      {
        worker: "Anna",
        role: "Kokki",
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
            start_time: "16:00:00",
            end_time: "22:00:00",
          },
          {
            ...base,
            date: "2026-09-30",
            start_time: null,
            end_time: null,
            code: "V",
          },
        ],
      },
    ]);
    expect(days[0].actualHours).toBe(10);
    expect(days[0].eveningHours).toBe(2);
    expect(days[1].source).toBe("planned");
    expect(summary[0].plannedHours).toBe(14);
    expect(summary[0].actualHours).toBe(10);
    expect(summary[0].missingActual).toBe(1);
    expect(summary[0].codes.V).toBe(1);
  });
  it("skips empty worker rows and builds CSV", () => {
    const { days } = buildPayroll([{ worker: "", role: "x", shifts: [] }]);
    expect(days).toHaveLength(0);
    const csv = toCsv([
      PAYROLL_DAY_HEADERS,
      payrollDayValues({
        date: "2026-01-01",
        worker: 'A "B"',
        role: "r",
        code: "",
        plannedStart: "",
        plannedEnd: "",
        plannedHours: 0,
        actualStart: "",
        actualEnd: "",
        actualHours: 0,
        source: "planned",
        eveningHours: 0,
        nightHours: 0,
        sundayHours: 0,
        note: "",
      }),
    ]);
    expect(csv).toContain('"A ""B"""');
  });
});
