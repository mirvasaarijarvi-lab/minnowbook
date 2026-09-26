import { describe, it, expect } from "vitest";
import {
  computeRowTotals,
  finnishSundayWorkHolidays,
  isSundayWorkDay,
  parseShiftInput,
  shiftMinutes,
  type ShiftCell,
} from "./shiftList";

const w = (start: string, end: string): ShiftCell => ({
  start_time: start,
  end_time: end,
  code: null,
});
const c = (code: ShiftCell["code"]): ShiftCell => ({
  start_time: null,
  end_time: null,
  code,
});
const row = (...xs: Array<[string, ShiftCell | null]>) =>
  computeRowTotals(xs.map(([date, cell]) => ({ date, cell })));

describe("Tunnit – working hours summary", () => {
  it("sums a normal week", () => {
    const t = row(
      ["2026-09-28", w("10:00", "18:00")],
      ["2026-09-29", w("09:30", "17:00")],
      ["2026-09-30", w("11:00", "15:15")],
    );
    expect(t.hours).toBe(8 + 7.5 + 4.25);
  });
  it("ignores empty days and day-off codes in hours", () => {
    const t = row(
      ["2026-09-28", null],
      ["2026-09-29", c("V")],
      ["2026-09-30", c("X")],
      ["2026-10-01", w("10:00", "14:00")],
    );
    expect(t.hours).toBe(4);
  });
  it("counts shifts over midnight", () => {
    expect(row(["2026-09-28", w("20:00", "02:00")]).hours).toBe(6);
    expect(shiftMinutes(w("22:00", "22:00"))).toBe(24 * 60);
  });
  it("rounds to two decimals", () => {
    expect(row(["2026-09-28", w("10:00", "10:20")]).hours).toBe(0.33);
  });
});

describe("X/Z and Loma columns", () => {
  it("counts X+Z days and L as holiday days", () => {
    const t = row(
      ["2026-09-28", c("X")],
      ["2026-09-29", c("Z")],
      ["2026-09-30", c("X")],
      ["2026-10-01", c("L")],
      ["2026-10-02", c("V")],
      ["2026-10-03", c("P")],
    );
    expect(t.xzDays).toBe(3);
    expect(t.holidayDays).toBe(1);
    expect(t.codes).toEqual({ V: 1, X: 2, Z: 1, L: 1, P: 1 });
    expect(t.hours).toBe(0);
  });
});

describe("Ilta 18–24 h", () => {
  it("no evening hours for a day shift ending at 18", () => {
    expect(row(["2026-09-28", w("10:00", "18:00")]).eveningHours).toBe(0);
  });
  it("counts only the part after 18", () => {
    expect(row(["2026-09-28", w("14:00", "22:30")]).eveningHours).toBe(4.5);
  });
  it("stops evening at midnight and moves the rest to night", () => {
    const t = row(["2026-09-28", w("17:00", "03:00")]);
    expect(t.eveningHours).toBe(6);
    expect(t.nightHours).toBe(3);
    expect(t.hours).toBe(10);
  });
});

describe("Yö 0–6 h", () => {
  it("counts early morning hours before 06", () => {
    const t = row(["2026-09-28", w("04:00", "12:00")]);
    expect(t.nightHours).toBe(2);
    expect(t.eveningHours).toBe(0);
  });
  it("caps overnight at 06", () => {
    expect(row(["2026-09-28", w("23:00", "08:00")]).nightHours).toBe(6);
  });
});

describe("Su/pyhä h", () => {
  it("counts all hours on a Sunday", () => {
    expect(row(["2026-10-11", w("10:00", "18:00")]).sundayHours).toBe(8);
  });
  it("no Sunday hours on a normal weekday or Saturday", () => {
    expect(row(["2026-10-10", w("10:00", "18:00")]).sundayHours).toBe(0);
    expect(row(["2026-10-07", w("10:00", "18:00")]).sundayHours).toBe(0);
  });
  it("splits Saturday night into Sunday only after midnight", () => {
    const t = row(["2026-10-10", w("20:00", "02:00")]);
    expect(t.sundayHours).toBe(2);
    expect(t.eveningHours).toBe(4);
    expect(t.nightHours).toBe(2);
  });
  it("Sunday night shift stops counting at Monday 00:00", () => {
    expect(row(["2026-10-11", w("20:00", "02:00")]).sundayHours).toBe(4);
  });
  it("Sunday evening counts for both Sunday and evening extras", () => {
    const t = row(["2026-10-11", w("16:00", "23:00")]);
    expect(t.sundayHours).toBe(7);
    expect(t.eveningHours).toBe(5);
  });
  it("counts vappu, itsenäisyyspäivä, pitkäperjantai and helatorstai (weekdays) as pyhä", () => {
    for (const d of [
      "2026-05-01",
      "2026-04-03",
      "2026-05-14",
      "2026-12-25",
      "2026-01-06",
      "2027-12-06",
    ]) {
      expect(isSundayWorkDay(d), d).toBe(true);
      expect(row([d, w("10:00", "14:00")]).sundayHours, d).toBe(4);
    }
  });
  it("2026 moving holidays are right", () => {
    const s = finnishSundayWorkHolidays(2026);
    for (const d of [
      "2026-04-03",
      "2026-04-05",
      "2026-04-06",
      "2026-05-14",
      "2026-05-24",
      "2026-06-20",
      "2026-10-31",
    ])
      expect(s.has(d), d).toBe(true);
    expect(s.has("2026-06-19")).toBe(false); // juhannusaatto isn't a pyhä
    expect(s.has("2026-12-24")).toBe(false); // jouluaatto isn't a pyhä
  });
  it("New Year's Eve night shift counts after midnight as pyhä", () => {
    expect(row(["2026-12-31", w("20:00", "02:00")]).sundayHours).toBe(2);
  });
});

describe("full row matches the summary columns", () => {
  it("3-week style mix", () => {
    const t = row(
      ["2026-10-05", w("10:00", "18:00")], // 8h
      ["2026-10-06", c("X")],
      ["2026-10-07", w("15:00", "23:00")], // 8h, 5 eve
      ["2026-10-08", c("Z")],
      ["2026-10-09", w("18:00", "01:00")], // 7h, 6 eve, 1 night
      ["2026-10-10", c("V")],
      ["2026-10-11", w("11:00", "19:00")], // 8h, 8 sun, 1 eve
      ["2026-10-12", c("L")],
    );
    expect(t).toMatchObject({
      hours: 31,
      xzDays: 2,
      sundayHours: 8,
      eveningHours: 12,
      nightHours: 1,
      holidayDays: 1,
    });
  });
});

describe("cell input", () => {
  it("accepts common formats and rejects garbage", () => {
    expect(parseShiftInput("10-18").ok).toBe(true);
    expect(parseShiftInput("9:30-17").ok).toBe(true);
    expect(parseShiftInput("x").ok).toBe(true);
    expect(parseShiftInput("").ok).toBe(true);
    expect(parseShiftInput("abc").ok).toBe(false);
    expect(parseShiftInput("25-30").ok).toBe(false);
  });
});
