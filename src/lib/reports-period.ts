/**
 * Shared period for every section on the Reports page, so the whole page
 * (and its print) describes the same customer-chosen time interval.
 * Panels fall back to their own period menu when rendered outside it.
 */
import { createContext, useContext } from "react";
import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";

export type PeriodPreset = "week" | "month" | "quarter" | "year" | "custom";

export interface ReportsPeriod {
  preset: PeriodPreset;
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  /** Human label, e.g. "1.9.2026 to 30.9.2026". */
  label: string;
  setPreset: (p: Exclude<PeriodPreset, "custom">) => void;
  setCustom: (start: Date, end: Date) => void;
}

export function rangeForPreset(
  preset: Exclude<PeriodPreset, "custom">,
  now = new Date(),
): { start: Date; end: Date } {
  switch (preset) {
    case "week":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export const periodLabel = (start: Date, end: Date) =>
  `${format(start, "d.M.yyyy")} to ${format(end, "d.M.yyyy")}`;

export const ReportsPeriodContext = createContext<ReportsPeriod | null>(null);

/** The shared Reports period, or null outside the Reports page. */
export const useReportsPeriod = () => useContext(ReportsPeriodContext);

/** Starts printing the whole Reports page or a single section. */
export function printReports(sectionId?: string) {
  if (typeof window === "undefined") return;
  const body = document.body;
  body.dataset.printingReports = "true";
  if (sectionId) body.dataset.printTarget = sectionId;
  const cleanup = () => {
    delete body.dataset.printingReports;
    delete body.dataset.printTarget;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
