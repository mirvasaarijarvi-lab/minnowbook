import { describe, it, expect } from "vitest";
import {
  buildWorkerLines,
  formatWorkerRow,
  createWorkerShiftPdf,
  WORKER_TOTAL_LABELS,
} from "./workerShiftPdf";

// Reads jsPDF text ops ("x y Td (text) Tj") and returns the figure printed on the same line right of a label.
const pdfNorm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[^A-Za-z0-9/ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
function pdfValueNextTo(raw: string, label: string): string | undefined {
  const ops = [...raw.matchAll(/([\d.]+) ([\d.]+) Td\n\((.*)\) Tj/g)].map(
    (m) => ({ x: +m[1], y: +m[2], t: m[3] }),
  );
  const hit = ops.filter((o) => pdfNorm(o.t) === pdfNorm(label));
  if (hit.length !== 1) return undefined;
  const [l] = hit;
  return ops
    .filter((o) => Math.abs(o.y - l.y) < 0.5 && o.x > l.x)
    .sort((a, b) => a.x - b.x)[0]?.t;
}

const lines = [
  {
    date: "2026-10-01",
    start: "11:00",
    end: "17:00",
    role: "vakitarjoilija",
    note: "kesäapulainen tulossa myös",
  },
  {
    date: "2026-09-27",
    start: "11:00",
    end: "17:00",
    role: "vakitarjoilija",
    note: "",
  },
  { date: "2026-09-28", start: "", end: "", role: "vakitarjoilija", note: "" },
];

describe("worker shift pdf", () => {
  it("keeps only working days, sorted by date", () => {
    expect(buildWorkerLines(lines).map((l) => l.date)).toEqual([
      "2026-09-27",
      "2026-10-01",
    ]);
  });
  it("formats rows like the paper sample", () => {
    expect(formatWorkerRow(lines[1])).toEqual([
      "27.9.2026",
      "11 - 17",
      "vakitarjoilija",
      "-",
    ]);
    expect(formatWorkerRow({ ...lines[0], start: "09:30" })[1]).toBe(
      "9:30 - 17",
    );
  });
  it("creates a pdf", () => {
    expect(createWorkerShiftPdf("Maija", lines).getNumberOfPages()).toBe(1);
  });
});

describe("worker shift pdf content", () => {
  it("contains name, headers, dates, hours and job title in order", () => {
    const raw = createWorkerShiftPdf("Maija Virtanen", lines, "fi").output();
    const order = [
      "Maija Virtanen",
      "Päivämäärä",
      "Työaika",
      "Työnimike",
      "Huom",
      "27.9.2026",
      "11 - 17",
      "vakitarjoilija",
      "1.10.2026",
    ];
    let pos = -1;
    for (const t of order) {
      const i = raw.indexOf(`(${t})`, pos + 1);
      expect(i, t).toBeGreaterThan(pos);
      pos = i;
    }
    expect(raw).not.toContain("(28.9.2026)");
  });
});

describe("worker totals footer", () => {
  it("sums hours, sunday/holiday and evening", async () => {
    const { workerTotals } = await import("./workerShiftPdf");
    const t = workerTotals([
      { date: "2026-09-21", start: "10:00", end: "17:00", role: "x", note: "" },
      { date: "2026-09-25", start: "12:00", end: "15:00", role: "x", note: "" },
      { date: "2026-09-27", start: "18:00", end: "20:00", role: "x", note: "" },
      { date: "2026-10-01", start: "11:00", end: "17:00", role: "x", note: "" },
    ]);
    expect(t).toEqual([
      ["Tunnit yhteensä", "18"],
      ["Su/pyhä h", "2"],
      ["Ilta h", "2"],
    ]);
  });
  it("prints the totals in the PDF", () => {
    const raw = createWorkerShiftPdf("A", [
      { date: "2026-09-27", start: "18:00", end: "20:30", role: "x", note: "" },
    ]).output();
    expect(raw).toContain("(Tunnit yhteens");
    expect(raw).toContain("(2,5)");
  });
  it("prints each figure next to its own label (fi/en/sv)", () => {
    const lines = [
      { date: "2026-09-21", start: "16:00", end: "20:00", role: "x", note: "" },
      { date: "2026-09-27", start: "10:00", end: "13:00", role: "x", note: "" },
    ];
    for (const lang of ["fi", "en", "sv"] as const) {
      const raw = createWorkerShiftPdf("A", lines, lang).output();
      expect(
        WORKER_TOTAL_LABELS[lang].map((lb) => pdfValueNextTo(raw, lb)),
        lang,
      ).toEqual(["7", "3", "2"]);
    }
  });
});
