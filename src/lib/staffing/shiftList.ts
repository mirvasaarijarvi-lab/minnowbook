// Pure helpers for the shift list (Työvuorolista). No I/O.

export const SHIFT_CODES = ["V", "X", "Z", "L", "P"] as const;
export type ShiftCode = (typeof SHIFT_CODES)[number];

export interface ShiftCell {
  start_time: string | null;
  end_time: string | null;
  code: ShiftCode | null;
}

export interface ParsedCell {
  ok: boolean;
  value: ShiftCell | null; // null = empty cell
}

const pad = (n: number) => String(n).padStart(2, "0");

const parseTime = (s: string): string | null => {
  const m = s.trim().match(/^(\d{1,2})(?::|\.)?(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return `${pad(h === 24 ? 0 : h)}:${pad(min)}`;
};

/** Parses "10-18", "9:30-17", "V" etc. Empty string → empty cell. */
export const parseShiftInput = (raw: string): ParsedCell => {
  const s = raw.trim().toUpperCase();
  if (!s) return { ok: true, value: null };
  if ((SHIFT_CODES as readonly string[]).includes(s)) {
    return { ok: true, value: { start_time: null, end_time: null, code: s as ShiftCode } };
  }
  const parts = s.split(/\s*[-–]\s*/);
  if (parts.length !== 2) return { ok: false, value: null };
  const a = parseTime(parts[0]);
  const b = parseTime(parts[1]);
  if (!a || !b || a === b) return { ok: false, value: null };
  return { ok: true, value: { start_time: a, end_time: b, code: null } };
};

export const formatShiftCell = (c: ShiftCell | null | undefined): string => {
  if (!c) return "";
  if (c.code) return c.code;
  if (c.start_time && c.end_time) {
    const f = (t: string) => {
      const [h, m] = t.split(":");
      return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
    };
    return `${f(c.start_time)}-${f(c.end_time)}`;
  }
  return "";
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes of a shift; crosses midnight if end <= start. */
export const shiftMinutes = (c: ShiftCell | null | undefined): number => {
  if (!c || c.code || !c.start_time || !c.end_time) return 0;
  const s = toMin(c.start_time);
  let e = toMin(c.end_time);
  if (e <= s) e += 24 * 60;
  return e - s;
};

/**
 * Based on MaRa TES (työntekijät): iltatyölisä klo 18–24, yötyölisä klo 24–06,
 * sunnuntaityökorvaus: sunnuntai, kirkolliset juhlapyhät, vappu, itsenäisyyspäivä.
 * Only hours are counted here — payroll is done in another system.
 */
export interface ShiftRules {
  eveningStart: number; // 18:00
  eveningEnd: number; // 24:00
  nightEnd: number; // 06:00 (night starts at 00:00)
  /** Count Finnish church holidays, May Day and Independence Day as Sunday work. */
  finnishHolidays?: boolean;
}

export const DEFAULT_SHIFT_RULES: ShiftRules = {
  eveningStart: 18 * 60,
  eveningEnd: 24 * 60,
  nightEnd: 6 * 60,
  finnishHolidays: true,
};

const overlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Easter Sunday (Gregorian, anonymous algorithm). */
const easter = (y: number): Date => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
};

const holidayCache = new Map<number, Set<string>>();
/** Finnish church holidays + vappu + itsenäisyyspäivä (days that count as sunday work). */
export const finnishSundayWorkHolidays = (y: number): Set<string> => {
  const cached = holidayCache.get(y);
  if (cached) return cached;
  const add = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const e = easter(y);
  // Juhannuspäivä: Saturday between 20–26 June; Pyhäinpäivä: Saturday between 31 Oct – 6 Nov
  const satBetween = (m: number, d0: number) => {
    for (let d = 0; d < 7; d++) { const x = new Date(y, m, d0 + d); if (x.getDay() === 6) return x; }
    return new Date(y, m, d0);
  };
  const s = new Set<string>([
    `${y}-01-01`, `${y}-01-06`, iso(add(e, -2)), iso(e), iso(add(e, 1)), `${y}-05-01`,
    iso(add(e, 39)), iso(add(e, 49)), iso(satBetween(5, 20)), iso(satBetween(9, 31)),
    `${y}-12-06`, `${y}-12-25`, `${y}-12-26`,
  ]);
  holidayCache.set(y, s);
  return s;
};

export const isSundayWorkDay = (dateISO: string, finnishHolidays = true): boolean => {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.getDay() === 0 || (finnishHolidays && finnishSundayWorkHolidays(d.getFullYear()).has(dateISO));
};

export interface RowTotals {
  hours: number;
  xzDays: number;
  /** Hours on Sundays and sunday-work holidays. */
  sundayHours: number;
  eveningHours: number;
  nightHours: number;
  holidayDays: number;
  codes: Record<ShiftCode, number>;
}

/** dateISO: "YYYY-MM-DD". Shifts past midnight are split by calendar day. */
export const computeRowTotals = (
  cells: Array<{ date: string; cell: ShiftCell | null }>,
  rules: ShiftRules = DEFAULT_SHIFT_RULES,
): RowTotals => {
  const codes: Record<ShiftCode, number> = { V: 0, X: 0, Z: 0, L: 0, P: 0 };
  let min = 0, sun = 0, eve = 0, night = 0;
  for (const { date, cell } of cells) {
    if (!cell) continue;
    if (cell.code) {
      codes[cell.code] += 1;
      continue;
    }
    const m = shiftMinutes(cell);
    if (!m || !cell.start_time) continue;
    min += m;
    const s = toMin(cell.start_time);
    const e = s + m;
    const d0 = new Date(`${date}T00:00:00`);
    const next = iso(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1));
    for (const [off, day] of [[0, date], [1440, next]] as const) {
      eve += overlap(s, e, rules.eveningStart + off, rules.eveningEnd + off);
      night += overlap(s, e, off, rules.nightEnd + off);
      if (isSundayWorkDay(day, rules.finnishHolidays !== false)) sun += overlap(s, e, off, off + 1440);
    }
  }
  const h = (x: number) => Math.round((x / 60) * 100) / 100;
  return {
    hours: h(min),
    xzDays: codes.X + codes.Z,
    sundayHours: h(sun),
    eveningHours: h(eve),
    nightHours: h(night),
    holidayDays: codes.L,
    codes,
  };
};

/** Minutes since midnight to "HH:MM" and back, for the pay rules form. */
export const minutesToHHMM = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
export const hhmmToMinutes = (v: string, fallback: number) => {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const n = Number(m[1]) * 60 + Number(m[2]);
  return n === 0 ? 24 * 60 : n;
};
