// Payroll export rows for the shift list. Pure; no I/O.
import { computeRowTotals, DEFAULT_SHIFT_RULES, shiftMinutes, type ShiftCell, type ShiftCode, type ShiftRules } from "./shiftList";
import { sanitizeCsvCell } from "@/lib/report-csv-export";

export interface PayrollShiftInput {
  date: string;
  start_time: string | null;
  end_time: string | null;
  code: ShiftCode | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  actual_note: string | null;
}

export interface PayrollSlotInput {
  worker: string;
  role: string;
  shifts: PayrollShiftInput[];
}

export interface PayrollDayRow {
  date: string;
  worker: string;
  role: string;
  code: string;
  plannedStart: string;
  plannedEnd: string;
  plannedHours: number;
  actualStart: string;
  actualEnd: string;
  actualHours: number;
  /** "toteutunut" when realized times exist, else "suunniteltu". */
  source: "actual" | "planned";
  eveningHours: number;
  nightHours: number;
  sundayHours: number;
  note: string;
}

export interface PayrollSummaryRow {
  worker: string;
  role: string;
  plannedHours: number;
  actualHours: number;
  eveningHours: number;
  nightHours: number;
  sundayHours: number;
  codes: Record<ShiftCode, number>;
  missingActual: number;
}

const t5 = (t: string | null) => (t ? t.slice(0, 5) : "");
const h = (m: number) => Math.round((m / 60) * 100) / 100;

export const buildPayroll = (slots: PayrollSlotInput[], rules: ShiftRules = DEFAULT_SHIFT_RULES) => {
  const days: PayrollDayRow[] = [];
  const summary: PayrollSummaryRow[] = [];
  for (const slot of slots) {
    if (!slot.worker) continue;
    const sum: PayrollSummaryRow = {
      worker: slot.worker, role: slot.role, plannedHours: 0, actualHours: 0,
      eveningHours: 0, nightHours: 0, sundayHours: 0,
      codes: { V: 0, X: 0, Z: 0, L: 0, P: 0 }, missingActual: 0,
    };
    for (const s of [...slot.shifts].sort((a, b) => a.date.localeCompare(b.date))) {
      const planned: ShiftCell = { start_time: t5(s.start_time) || null, end_time: t5(s.end_time) || null, code: s.code };
      const hasActual = !!(s.actual_start_time && s.actual_end_time);
      const actual: ShiftCell | null = hasActual
        ? { start_time: t5(s.actual_start_time), end_time: t5(s.actual_end_time), code: null }
        : null;
      const basis = actual ?? planned;
      const tot = computeRowTotals([{ date: s.date, cell: basis }], rules);
      if (s.code) sum.codes[s.code] += 1;
      const pm = shiftMinutes(planned);
      const am = actual ? shiftMinutes(actual) : 0;
      if (!s.code && !hasActual && pm > 0) sum.missingActual += 1;
      sum.plannedHours += pm;
      sum.actualHours += am;
      sum.eveningHours += tot.eveningHours;
      sum.nightHours += tot.nightHours;
      sum.sundayHours += tot.sundayHours;
      days.push({
        date: s.date, worker: slot.worker, role: slot.role, code: s.code ?? "",
        plannedStart: planned.start_time ?? "", plannedEnd: planned.end_time ?? "", plannedHours: h(pm),
        actualStart: actual?.start_time ?? "", actualEnd: actual?.end_time ?? "", actualHours: h(am),
        source: hasActual ? "actual" : "planned",
        eveningHours: tot.eveningHours, nightHours: tot.nightHours, sundayHours: tot.sundayHours,
        note: s.actual_note ?? "",
      });
    }
    sum.plannedHours = h(sum.plannedHours);
    sum.actualHours = h(sum.actualHours);
    const r = (x: number) => Math.round(x * 100) / 100;
    sum.eveningHours = r(sum.eveningHours);
    sum.nightHours = r(sum.nightHours);
    sum.sundayHours = r(sum.sundayHours);
    summary.push(sum);
  }
  return { days, summary };
};

export type PayrollLang = "fi" | "en" | "sv";

const PH = {
  en: { date: "Date", worker: "Worker", role: "Role", code: "Code", ps: "Planned start", pe: "Planned end", ph: "Planned h", as: "Actual start", ae: "Actual end", ah: "Actual h", basis: "Basis", eve: "Evening h", night: "Night h", sun: "Sun/holiday h", note: "Note", missing: "Missing actual (shifts)", actual: "actual", planned: "planned" },
  fi: { date: "Päivä", worker: "Työntekijä", role: "Tehtävä", code: "Koodi", ps: "Suunn. alku", pe: "Suunn. loppu", ph: "Suunn. h", as: "Tot. alku", ae: "Tot. loppu", ah: "Tot. h", basis: "Laskentaperuste", eve: "Ilta h", night: "Yö h", sun: "Su/pyhä h", note: "Huom", missing: "Toteuma puuttuu (vuoroa)", actual: "toteutunut", planned: "suunniteltu" },
  sv: { date: "Datum", worker: "Anställd", role: "Uppgift", code: "Kod", ps: "Plan. start", pe: "Plan. slut", ph: "Plan. h", as: "Utf. start", ae: "Utf. slut", ah: "Utf. h", basis: "Grund", eve: "Kväll h", night: "Natt h", sun: "Sö/helg h", note: "Anm.", missing: "Utfört saknas (turer)", actual: "utfört", planned: "planerat" },
} as const;

export const payrollDayHeaders = (lang: PayrollLang = "fi") => {
  const t = PH[lang];
  return [t.date, t.worker, t.role, t.code, t.ps, t.pe, t.ph, t.as, t.ae, t.ah, t.basis, t.eve, t.night, t.sun, t.note];
};
export const PAYROLL_DAY_HEADERS = payrollDayHeaders("fi");

export const payrollDayValues = (r: PayrollDayRow, lang: PayrollLang = "fi"): (string | number)[] => [
  r.date, r.worker, r.role, r.code, r.plannedStart, r.plannedEnd, r.plannedHours,
  r.actualStart, r.actualEnd, r.actualHours, r.source === "actual" ? PH[lang].actual : PH[lang].planned,
  r.eveningHours, r.nightHours, r.sundayHours, r.note,
];

export const payrollSummaryHeaders = (lang: PayrollLang = "fi") => {
  const t = PH[lang];
  return [t.worker, t.role, t.ph, t.ah, t.eve, t.night, t.sun, "V", "X", "Z", "L", "P", t.missing];
};

export const payrollSummaryValues = (r: PayrollSummaryRow): (string | number)[] => [
  r.worker, r.role, r.plannedHours, r.actualHours, r.eveningHours, r.nightHours, r.sundayHours,
  r.codes.V, r.codes.X, r.codes.Z, r.codes.L, r.codes.P, r.missingActual,
];

/** Semicolon CSV with BOM (opens in Excel). Text cells are guarded against formula injection. */
export const toCsv = (rows: (string | number)[][]): string =>
  "\ufeff" + rows.map((r) => r.map((c) => `"${typeof c === "number" ? String(c) : sanitizeCsvCell(String(c))}"`).join(";")).join("\r\n");
