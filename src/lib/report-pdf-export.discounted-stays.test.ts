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
 * Integration regression: the period report PDF must print, for discounted
 * multi-night stays, exactly the amount the guest is charged, never the list
 * price and never any step of a discount stack. The PDF is generated for real,
 * its text is read back with pdftotext, and each row's room + breakfast columns
 * are compared to the charged amount to the cent.
 */

const hasPdfToText = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

interface DiscountedCase {
  label: string;
  /** Undiscounted list price, must never appear in the PDF. */
  listPrice: number;
  /** Intermediate figures from the discount stack, must never appear either. */
  intermediates: number[];
  row: ReportPricingRow;
}

const checkOut = (nights: number) =>
  new Date(Date.UTC(2027, 2, 1) + nights * 86400000).toISOString().slice(0, 10);

const stay = (
  nights: number,
  guests: number,
  breakfastRate: number | null,
  charged: number | null,
  over: Partial<ReportPricingRow> = {},
): ReportPricingRow => ({
  reservation_type: "guesthouse",
  date: "2027-03-01",
  check_out_date: checkOut(nights),
  guests_count: guests,
  breakfast_included: breakfastRate !== null,
  breakfast_price_per_person: breakfastRate,
  price_eur: charged,
  ...over,
});

const CASES: DiscountedCase[] = [
  {
    // 4 nights x 120 + breakfast 14.5 x 2 x 4 = 596, promo code -25%.
    label: "percentage promo code",
    listPrice: 596,
    intermediates: [],
    row: stay(4, 2, 14.5, roundCents(596 * 0.75)),
  },
  {
    // 3 nights x 89.90 + breakfast 12 x 2 x 3 = 341.70, 50 EUR coupon.
    label: "fixed coupon",
    listPrice: 341.7,
    intermediates: [],
    row: stay(3, 2, 12, roundCents(341.7 - 50)),
  },
  {
    // Stacked: -20%, then -30 EUR, then -5% loyalty.
    label: "stacked promos",
    listPrice: 596,
    intermediates: [476.8, 446.8],
    row: stay(4, 2, 14.5, roundCents((596 * 0.8 - 30) * 0.95)),
  },
  {
    // Hotel, 7 nights, 4 guests, awkward breakfast rate, -33%.
    label: "long discounted hotel stay",
    listPrice: roundCents(7 * 179.5 + 21.5 * 4 * 7),
    intermediates: [],
    row: stay(7, 4, 21.5, roundCents((7 * 179.5 + 21.5 * 4 * 7) * 0.67), {
      reservation_type: "hotel",
    }),
  },
  {
    // Discounted below the breakfast value: breakfast capped, room line 0.
    label: "deeply discounted stay",
    listPrice: roundCents(5 * 110 + 18 * 3 * 5),
    intermediates: [],
    row: stay(5, 3, 18, 95),
  },
  {
    label: "comped stay",
    listPrice: 596,
    intermediates: [],
    row: stay(4, 2, 14.5, 0),
  },
  {
    label: "manual adjustment above list",
    listPrice: 596,
    intermediates: [506.6],
    row: stay(4, 2, 14.5, 640.35),
  },
  {
    label: "discounted stay without breakfast",
    listPrice: 480,
    intermediates: [],
    row: stay(4, 2, null, 384),
  },
  {
    label: "discounted stay with no stored breakfast rate (fallback)",
    listPrice: roundCents(4 * 120 + 15 * 2 * 4),
    intermediates: [],
    row: stay(4, 2, null, roundCents((4 * 120 + 15 * 2 * 4) * 0.8), {
      breakfast_included: true,
    }),
  },
  {
    label: "menu-priced dinner carrying a discount",
    listPrice: 500,
    intermediates: [400],
    row: stay(0, 10, null, 400, {
      reservation_type: "restaurant",
      pricing_type: "menu",
      check_out_date: null,
    }),
  },
  {
    label: "discounted stay still awaiting a price",
    listPrice: 596,
    intermediates: [],
    row: stay(4, 2, 14.5, null),
  },
];

const buildPdfBytes = () => {
  const rows = CASES.map((c) => c.row);
  const grandTotal = sumReportAmounts(rows).charged;
  const doc = buildReportPdf({
    title: "Period report",
    subtitle: "1.3.2027 - 31.3.2027",
    kpis: [
      { label: "Bookings", value: String(rows.length) },
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
      body: CASES.map((c, i) => {
        const cells = pdfPriceCells(c.row);
        return [
          "1.3.2027",
          `Guest ${i + 1}`,
          c.row.reservation_type,
          String(c.row.guests_count ?? "-"),
          "confirmed",
          "No",
          "Yes",
          cells.room,
          cells.breakfast,
          cells.total,
        ];
      }),
      numericColumns: [3, 7, 8, 9],
    },
    fileName: "period-report-discounted-test",
  });
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
};

const pdfText = (bytes: Uint8Array) => {
  const dir = mkdtempSync(path.join(tmpdir(), "report-pdf-disc-"));
  const pdfPath = path.join(dir, "report.pdf");
  const txtPath = path.join(dir, "report.txt");
  writeFileSync(pdfPath, bytes);
  execFileSync("pdftotext", ["-layout", pdfPath, txtPath]);
  return readFileSync(txtPath, "utf8");
};

describe("period report PDF for discounted multi-night stays", () => {
  it.skipIf(!hasPdfToText)("prints the guest-charged total, split to the cent", () => {
    const text = pdfText(buildPdfBytes());
    const lines = text.split("\n");

    let priced = 0;
    let placeholders = 0;
    let cappedBreakfast = 0;
    let totalCents = 0;

    CASES.forEach((c, i) => {
      const why = `${c.label} (row ${i + 1})`;
      const a = reportAmounts(c.row);
      const line = lines.find((l) => l.includes(`Guest ${i + 1}`));
      expect(line, `${why} missing from the PDF`).toBeTruthy();

      const money = line!
        .trim()
        .split(/\s{2,}|\s+/)
        .slice(-3);

      if (money[2] === PDF_NO_AMOUNT) {
        // No amount: all three columns show a dash, never 0.00.
        expect(money, why).toEqual([PDF_NO_AMOUNT, PDF_NO_AMOUNT, PDF_NO_AMOUNT]);
        expect(a.hasAmount, why).toBe(false);
        placeholders++;
        return;
      }

      const room = Number(money[0]);
      const breakfast = money[1] === PDF_NO_AMOUNT ? 0 : Number(money[1]);
      const total = Number(money[2]);

      // The printed split adds up, and equals what the guest is charged.
      expect(Math.round(room * 100) + Math.round(breakfast * 100), why).toBe(
        Math.round(total * 100),
      );
      expect(total, why).toBeCloseTo(c.row.price_eur ?? 0, 10);
      expect(total, why).toBeCloseTo(a.charged, 10);
      expect(room >= 0, why).toBe(true);
      if (breakfast > 0 && room === 0) cappedBreakfast++;

      totalCents += Math.round(total * 100);
      priced++;
    });

    expect(priced).toBeGreaterThan(6);
    expect(placeholders).toBeGreaterThan(0);
    expect(cappedBreakfast).toBeGreaterThan(0);

    // The grand total printed at the top equals the sum of the printed totals.
    const grandTotal = sumReportAmounts(CASES.map((c) => c.row)).charged;
    expect(totalCents).toBe(Math.round(grandTotal * 100));
    expect(text).toContain(`${grandTotal.toFixed(2)} EUR`);
  });

  it.skipIf(!hasPdfToText)("never prints a list price or a discount step", () => {
    const text = pdfText(buildPdfBytes());

    // A figure is only forbidden if no row legitimately charges that amount
    // (two different stays can coincide, e.g. one stay's list price equals
    // another stay's discounted total).
    const chargedCents = new Set(
      CASES.map((c) => Math.round(reportAmounts(c.row).charged * 100)),
    );

    for (const c of CASES) {
      const forbidden = [c.listPrice, ...c.intermediates].filter(
        (v) => !chargedCents.has(Math.round(v * 100)),
      );
      for (const value of forbidden) {
        expect(
          text.includes(value.toFixed(2)),
          `${c.label}: ${value.toFixed(2)} must not appear in the PDF`,
        ).toBe(false);
      }
    }

    // A menu-priced dinner contributes nothing, discount or not.
    const menuCase = CASES.find((c) => c.row.pricing_type === "menu")!;
    expect(reportAmounts(menuCase.row).charged).toBe(0);
  });
});
