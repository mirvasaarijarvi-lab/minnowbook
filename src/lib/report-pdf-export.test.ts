import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildReportPdf } from "./reportsPdf";
import { PDF_NO_AMOUNT, pdfPriceCells } from "./report-export-cells";
import {
  reportAmounts,
  sumReportAmounts,
  roundCents,
  type ReportPricingRow,
} from "./report-pricing-accessor";

/**
 * Generates the real period report PDF, extracts its text with pdftotext and
 * checks the money columns as a reader would: for every stay the room column
 * plus the breakfast column equals the total column, and the grand total KPI
 * equals the sum of the totals, to the cent.
 */

const hasPdfToText = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const stay = (over: Partial<ReportPricingRow> = {}): ReportPricingRow => ({
  reservation_type: "guesthouse",
  date: "2026-11-02",
  check_out_date: "2026-11-05",
  guests_count: 2,
  breakfast_included: true,
  breakfast_price_per_person: 12,
  price_eur: 297,
  ...over,
});

const nightsLater = (nights: number) =>
  new Date(Date.UTC(2026, 10, 2) + nights * 86400000)
    .toISOString()
    .slice(0, 10);

const ROWS: ReportPricingRow[] = [
  stay(),
  stay({ breakfast_price_per_person: 8.95, guests_count: 3, price_eur: 383.6 }),
  stay({ breakfast_price_per_person: null, price_eur: 315 }),
  stay({
    breakfast_included: false,
    breakfast_price_per_person: null,
    price_eur: 225,
  }),
  stay({ breakfast_price_per_person: 18, guests_count: 3, price_eur: 40 }), // deep discount
  stay({
    reservation_type: "hotel",
    breakfast_price_per_person: 21.5,
    price_eur: 396,
  }),
  stay({
    reservation_type: "venue",
    breakfast_included: false,
    price_eur: 450,
  }),
  stay({
    reservation_type: "restaurant",
    pricing_type: "menu",
    breakfast_included: false,
    price_eur: 80,
  }),
  stay({ price_eur: null }),
  stay({
    check_out_date: nightsLater(17),
    guests_count: 9,
    breakfast_price_per_person: 11.11,
    price_eur: roundCents(83.33 * 17 + 11.11 * 9 * 17),
  }),
  stay({
    check_out_date: nightsLater(2),
    guests_count: 1,
    breakfast_price_per_person: 12.345,
    price_eur: roundCents(96 * 2 + 12.345 * 1 * 2),
  }),
];

const buildPdfBytes = () => {
  const grandTotal = sumReportAmounts(ROWS).charged;
  const doc = buildReportPdf({
    title: "Period report",
    subtitle: "1.11.2026 - 30.11.2026",
    kpis: [
      { label: "Bookings", value: String(ROWS.length) },
      { label: "Grand total", value: `${grandTotal.toFixed(2)} EUR` },
    ],
    table: {
      head: [
        "Date",
        "Guest",
        "Type",
        "Guests",
        "Status",
        "Used",
        "Invoiced",
        "Price (EUR)",
        "Breakfast (EUR)",
        "Total (EUR)",
      ],
      body: ROWS.map((r, i) => {
        const cells = pdfPriceCells(r);
        return [
          "2.11.2026",
          `Guest ${i + 1}`,
          r.reservation_type,
          String(r.guests_count ?? "-"),
          "confirmed",
          "No",
          "No",
          cells.room,
          cells.breakfast,
          cells.total,
        ];
      }),
      numericColumns: [3, 7, 8, 9],
    },
    fileName: "period-report-test",
  });
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
};

/** Extract the PDF's text with pdftotext, preserving the table layout. */
const pdfText = (bytes: Uint8Array) => {
  const dir = mkdtempSync(path.join(tmpdir(), "report-pdf-"));
  const pdfPath = path.join(dir, "report.pdf");
  const txtPath = path.join(dir, "report.txt");
  writeFileSync(pdfPath, bytes);
  execFileSync("pdftotext", ["-layout", pdfPath, txtPath]);
  return readFileSync(txtPath, "utf8");
};

describe("generated period report PDF", () => {
  it.skipIf(!hasPdfToText)(
    "shows a room + breakfast split that matches the total to the cent",
    () => {
      const text = pdfText(buildPdfBytes());
      const lines = text.split("\n");

      let checkedSplits = 0;
      let checkedPlaceholders = 0;
      let totalCents = 0;

      ROWS.forEach((r, i) => {
        const a = reportAmounts(r);
        const cells = pdfPriceCells(r);
        const line = lines.find((l) => l.includes(`Guest ${i + 1}`));
        expect(line, `row ${i + 1} missing from the PDF`).toBeTruthy();

        // Read the money columns back off the rendered row.
        const money = line!
          .trim()
          .split(/\s{2,}|\s+/)
          .slice(-3);
        expect(money, `row ${i + 1} money columns`).toEqual([
          cells.room,
          cells.breakfast,
          cells.total,
        ]);

        if (cells.total === PDF_NO_AMOUNT) {
          expect(a.hasAmount).toBe(false);
          checkedPlaceholders++;
          return;
        }

        const room = Number(money[0]);
        const breakfast = money[1] === PDF_NO_AMOUNT ? 0 : Number(money[1]);
        const total = Number(money[2]);
        // The printed columns add up exactly, in cents.
        expect(Math.round(room * 100) + Math.round(breakfast * 100)).toBe(
          Math.round(total * 100),
        );
        expect(total).toBeCloseTo(a.charged, 10);
        totalCents += Math.round(total * 100);
        checkedSplits++;
      });

      expect(checkedSplits).toBeGreaterThan(5);
      expect(checkedPlaceholders).toBeGreaterThan(0);

      // The grand total KPI in the PDF equals the sum of the printed totals.
      const expectedGrand = sumReportAmounts(ROWS).charged;
      expect(totalCents).toBe(Math.round(expectedGrand * 100));
      expect(text).toContain(`${expectedGrand.toFixed(2)} EUR`);
    },
  );

  it("keeps the PDF export reading its money from the shared cells", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../components/dashboard/ReportsPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("pdfPriceCells(r)");
    expect(src).toContain("cells.room");
    expect(src).toContain("cells.breakfast");
    expect(src).toContain("cells.total");
    // The old inline PDF amount is gone.
    expect(src).not.toMatch(
      /effectivePrice\(r\)\s*>\s*0\s*\?\s*effectivePrice\(r\)\.toFixed/,
    );
  });
});
