import { describe, it, expect } from "vitest";
import { parseShiftInput, formatShiftCell, shiftMinutes, computeRowTotals, isSundayWorkDay } from "./shiftList";

describe("parseShiftInput", () => {
  it("parses ranges and codes", () => {
    expect(parseShiftInput("10-18").value).toEqual({ start_time: "10:00", end_time: "18:00", code: null });
    expect(parseShiftInput("9:30–17").value?.start_time).toBe("09:30");
    expect(parseShiftInput("v").value?.code).toBe("V");
    expect(parseShiftInput("").value).toBeNull();
    expect(parseShiftInput("abc").ok).toBe(false);
    expect(parseShiftInput("25-26").ok).toBe(false);
  });
  it("formats back", () => {
    expect(formatShiftCell({ start_time: "09:30", end_time: "17:00", code: null })).toBe("9:30-17");
  });
});

describe("totals", () => {
  it("counts hours across midnight", () => {
    expect(shiftMinutes({ start_time: "20:00", end_time: "02:00", code: null })).toBe(360);
  });
  it("computes evening 18-24, night 0-6, sunday and codes (MaRa TES)", () => {
    const t = computeRowTotals([
      { date: "2026-09-27", cell: { start_time: "16:00", end_time: "02:00", code: null } }, // Sunday → Monday
      { date: "2026-09-28", cell: { start_time: null, end_time: null, code: "X" } },
      { date: "2026-09-29", cell: { start_time: null, end_time: null, code: "L" } },
    ]);
    expect(t.hours).toBe(10);
    expect(t.sundayHours).toBe(8); // only the Sunday part
    expect(t.eveningHours).toBe(6);
    expect(t.nightHours).toBe(2);
    expect(t.xzDays).toBe(1);
    expect(t.holidayDays).toBe(1);
  });
  it("counts Finnish holidays as sunday work", () => {
    expect(isSundayWorkDay("2026-04-03")).toBe(true); // pitkäperjantai
    expect(isSundayWorkDay("2026-05-01")).toBe(true);
    expect(isSundayWorkDay("2026-06-20")).toBe(true); // juhannuspäivä
    expect(isSundayWorkDay("2026-12-06")).toBe(true);
    expect(isSundayWorkDay("2026-09-29")).toBe(false);
  });
});
