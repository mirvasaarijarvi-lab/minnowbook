import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import { computeRowTotals } from "./shiftList";

export interface WorkerShiftLine {
  date: string;
  start: string;
  end: string;
  role: string;
  note: string;
}

export const WORKER_PDF_HEADERS = {
  fi: ["Päivämäärä", "Työaika", "Työnimike", "Huom"],
  en: ["Date", "Working hours", "Job title", "Notes"],
  sv: ["Datum", "Arbetstid", "Befattning", "Anm."],
} as const;

/** Shared layout (mm on A4) used by both the PDF and the on-screen preview. */
export const WORKER_SHEET_LAYOUT = {
  pageWidth: 210,
  marginX: 20,
  nameY: 25,
  headerY: 40,
  cols: [20, 60, 110, 150],
  noteWidth: 40,
  nameSize: 14,
  bodySize: 11,
  noteSize: 8,
  rowGap: 6,
  noteLineGap: 3.5,
} as const;

const trimTime = (t: string) => t.replace(/^0(\d)/, "$1").replace(/:00$/, "");

/** Sorted, time-bearing lines only (days off / codes are left out). */
export function buildWorkerLines(lines: WorkerShiftLine[]): WorkerShiftLine[] {
  return lines
    .filter((l) => l.start && l.end)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
    );
}

export function formatWorkerRow(
  l: WorkerShiftLine,
): [string, string, string, string] {
  return [
    format(parseISO(`${l.date}T00:00:00`), "d.M.yyyy"),
    `${trimTime(l.start)} - ${trimTime(l.end)}`,
    l.role || "-",
    l.note?.trim() || "-",
  ];
}

export const WORKER_TOTAL_LABELS = {
  fi: ["Tunnit yhteensä", "Su/pyhä h", "Ilta h"],
  en: ["Total hours", "Sun/holiday h", "Evening h"],
  sv: ["Timmar totalt", "Sön/helg h", "Kväll h"],
} as const;

const fmtH = (n: number) => String(n).replace(".", ",");

/** Totals for the sheet footer: [label, value] pairs. */
export function workerTotals(
  lines: WorkerShiftLine[],
  lang: "fi" | "en" | "sv" = "fi",
): Array<[string, string]> {
  const t = computeRowTotals(
    buildWorkerLines(lines).map((l) => ({
      date: l.date,
      cell: { start_time: l.start, end_time: l.end, code: null },
    })),
  );
  const lb = WORKER_TOTAL_LABELS[lang];
  return [
    [lb[0], fmtH(t.hours)],
    [lb[1], fmtH(t.sundayHours)],
    [lb[2], fmtH(t.eveningHours)],
  ];
}

export function createWorkerShiftPdf(
  name: string,
  lines: WorkerShiftLine[],
  lang: "fi" | "en" | "sv" = "fi",
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = WORKER_SHEET_LAYOUT;
  const cols = L.cols;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(L.nameSize);
  doc.text(name, L.marginX, L.nameY);
  doc.setFontSize(L.bodySize);
  let y: number = L.headerY;
  WORKER_PDF_HEADERS[lang].forEach((h, i) => doc.text(h, cols[i], y));
  y += 7;
  for (const l of buildWorkerLines(lines)) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    const row = formatWorkerRow(l);
    row.slice(0, 3).forEach((v, i) => doc.text(v, cols[i], y));
    doc.setFontSize(row[3] === "-" ? L.bodySize : L.noteSize);
    const noteLines: string[] = doc.splitTextToSize(row[3], L.noteWidth);
    doc.text(noteLines, cols[3], y);
    doc.setFontSize(L.bodySize);
    y += L.rowGap + Math.max(0, noteLines.length - 1) * L.noteLineGap;
  }
  if (y > 262) {
    doc.addPage();
    y = 20;
  }
  y += 4;
  doc.line(L.marginX, y - 4, L.pageWidth - L.marginX, y - 4);
  for (const [label, value] of workerTotals(lines, lang)) {
    doc.text(label, L.cols[0], y);
    doc.text(value, L.cols[1], y);
    y += L.rowGap;
  }
  return doc;
}
