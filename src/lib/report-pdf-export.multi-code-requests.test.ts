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
 * Regression: after a guest's request carried several promo codes, the period
 * report PDF must still print only the finalized room and breakfast amounts.
 *
 * The server refuses a request with more than one code and applies at most one
 * code, so nothing about the attempted combination may reach paper:
 *   - never the undiscounted list price
 *   - never the amount the second code would have produced
 *   - never a stacked figure (both codes applied one after the other)
 *   - never a "best of the two codes" figure the client might have shown
 *   - a booking whose multi-code request was refused has no row at all
 *
 * The PDF is generated for real and read back with pdftotext, so the numbers
 * checked are the ones a printed report actually shows.
 */

const hasPdfToText = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const checkOut = (nights: number) =>
  new Date(Date.UTC(2027, 4, 3) + nights * 86400000).toISOString().slice(0, 10);

const stay = (
  nights: number,
  guests: number,
  breakfastRate: number | null,
  charged: number | null,
  over: Partial<ReportPricingRow> = {},
): ReportPricingRow => ({
  reservation_type: "guesthouse",
  date: "2027-05-03",
  check_out_date: checkOut(nights),
  guests_count: guests,
  breakfast_included: breakfastRate !== null,
  breakfast_price_per_person: breakfastRate,
  price_eur: charged,
  ...over,
});

interface MultiCodeCase {
  label: string;
  /** Undiscounted list price: must never be printed. */
  listPrice: number;
  /** Figures the rejected code combinations would have produced. */
  forbidden: number[];
  /** True when the finalized amount is the list price (no code applied). */
  chargesListPrice?: boolean;
  row: ReportPricingRow;
}

// Two nights, two guests, 110 per night + 15 breakfast = 280 list.
const LIST_A = 2 * 110 + 15 * 2 * 2; // 280
// Four nights, three guests, 145 per night + 18.50 breakfast = 802.
const LIST_B = roundCents(4 * 145 + 18.5 * 3 * 4); // 802

const CASES: MultiCodeCase[] = [
  {
    // Guest sent "PCT20,FIX40"; refused, then retried with PCT20 alone.
    label: "one percentage code after a refused pair",
    listPrice: LIST_A,
    forbidden: [
      roundCents(LIST_A - 40), // the fixed code alone
      roundCents(LIST_A * 0.8 - 40), // both stacked
      roundCents((LIST_A - 40) * 0.8), // both stacked, other order
    ],
    row: stay(2, 2, 15, roundCents(LIST_A * 0.8)), // 224
  },
  {
    // Guest sent the same code twice; refused, then the code applied once.
    label: "one fixed code after a duplicated code",
    listPrice: LIST_A,
    forbidden: [
      roundCents(LIST_A - 80), // the code counted twice
      roundCents(LIST_A - 120), // counted three times
    ],
    row: stay(2, 2, 15, roundCents(LIST_A - 40)), // 240
  },
  {
    // Valid + expired code refused; the valid one applied on the retry.
    label: "valid code kept after a valid/expired pair",
    listPrice: LIST_B,
    forbidden: [
      roundCents(LIST_B * 0.5), // the expired 50% code
      roundCents(LIST_B * 0.8 * 0.5), // both stacked
    ],
    row: stay(4, 3, 18.5, roundCents(LIST_B * 0.8)),
  },
  {
    // Valid + another business's 90% code refused; ours applied alone.
    label: "own code kept over a foreign code",
    listPrice: LIST_B,
    forbidden: [
      roundCents(LIST_B * 0.1), // the foreign 90% code
      roundCents(LIST_B * 0.1 * 0.8),
    ],
    row: stay(4, 3, 18.5, roundCents(LIST_B - 40)),
  },
  {
    // Every code refused, so the booking carries the full price.
    label: "no code applied at all",
    listPrice: LIST_A,
    forbidden: [roundCents(LIST_A * 0.8), roundCents(LIST_A - 40)],
    chargesListPrice: true,
    row: stay(2, 2, 15, LIST_A),
  },
  {
    // Deep single discount below the breakfast value: breakfast is capped and
    // the room line is 0.00, never a negative figure.
    label: "deep single discount caps breakfast",
    listPrice: LIST_B,
    forbidden: [roundCents(LIST_B * 0.05)],
    row: stay(4, 3, 18.5, 150),
  },
  {
    // Menu-priced dinner where the client had shown a stacked figure.
    label: "menu dinner with one code",
    listPrice: 600,
    forbidden: [420, 390],
    row: stay(0, 12, null, 480, {
      reservation_type: "restaurant",
      pricing_type: "menu",
      check_out_date: null,
    }),
  },
  {
    // Refused multi-code request left the booking without a price: the PDF
    // shows dashes, never 0.00 and never a discounted guess.
    label: "still awaiting a price after a refusal",
    listPrice: LIST_A,
    forbidden: [roundCents(LIST_A * 0.8)],
    row: stay(2, 2, 15, null),
  },
];

/** A booking whose multi-code request was refused: never stored, never printed. */
const REFUSED_GUEST = "Refused Multi Code Guest";

const buildPdfBytes = () => {
  const rows = CASES.map((c) => c.row);
  const grandTotal = sumReportAmounts(rows).charged;
  const doc = buildReportPdf({
    title: "Period report",
    subtitle: "1.5.2027 - 31.5.2027",
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
          "3.5.2027",
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
    fileName: "period-report-multi-code-test",
  });
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
};

const pdfText = (bytes: Uint8Array) => {
  const dir = mkdtempSync(path.join(tmpdir(), "report-pdf-multicode-"));
  const pdfPath = path.join(dir, "report.pdf");
  const txtPath = path.join(dir, "report.txt");
  writeFileSync(pdfPath, bytes);
  execFileSync("pdftotext", ["-layout", pdfPath, txtPath]);
  return readFileSync(txtPath, "utf8");
};

describe("period report PDF after multi-code discount requests", () => {
  it.skipIf(!hasPdfToText)(
    "prints only the finalized room and breakfast amounts",
    () => {
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
          expect(money, why).toEqual([PDF_NO_AMOUNT, PDF_NO_AMOUNT, PDF_NO_AMOUNT]);
          expect(a.hasAmount, why).toBe(false);
          placeholders++;
          return;
        }

        const room = Number(money[0]);
        const breakfast = money[1] === PDF_NO_AMOUNT ? 0 : Number(money[1]);
        const total = Number(money[2]);

        // Room + breakfast is the finalized charged amount, to the cent.
        expect(Math.round(room * 100) + Math.round(breakfast * 100), why).toBe(
          Math.round(total * 100),
        );
        expect(total, why).toBeCloseTo(c.row.price_eur ?? 0, 10);
        expect(total, why).toBeCloseTo(a.charged, 10);
        expect(room >= 0, `${why}: no negative room line`).toBe(true);
        expect(breakfast >= 0, `${why}: no negative breakfast line`).toBe(true);
        // A discounted row never prints the list price as its total. The row
        // where every code was refused is charged the list price on purpose.
        if (!c.chargesListPrice) {
          expect(total, `${why}: list price not printed as the total`).not.toBeCloseTo(
            c.listPrice,
            10,
          );
        }
        if (breakfast > 0 && room === 0) cappedBreakfast++;

        totalCents += Math.round(total * 100);
        priced++;
      });

      expect(priced).toBeGreaterThan(5);
      // Exactly the rows without a finalized amount print dashes.
      expect(placeholders).toBe(
        CASES.filter((c) => !reportAmounts(c.row).hasAmount).length,
      );
      expect(cappedBreakfast).toBeGreaterThan(0);

      const grandTotal = sumReportAmounts(CASES.map((c) => c.row)).charged;
      expect(totalCents).toBe(Math.round(grandTotal * 100));
      expect(text).toContain(`${grandTotal.toFixed(2)} EUR`);
    },
  );

  it.skipIf(!hasPdfToText)(
    "never prints a second code's amount, a stacked figure or a list price",
    () => {
      const text = pdfText(buildPdfBytes());

      // Amounts that a row legitimately charges (or prints as its room or
      // breakfast line) are allowed even if some rejected combination happens
      // to produce the same figure.
      const allowedCents = new Set<number>();
      for (const c of CASES) {
        const a = reportAmounts(c.row);
        if (!a.hasAmount) continue;
        allowedCents.add(Math.round(a.charged * 100));
        allowedCents.add(Math.round(a.room * 100));
        if (a.breakfast > 0) allowedCents.add(Math.round(a.breakfast * 100));
      }
      allowedCents.add(Math.round(sumReportAmounts(CASES.map((c) => c.row)).charged * 100));

      const forbidden = new Set<number>();
      for (const c of CASES) {
        for (const value of [c.listPrice, ...c.forbidden]) {
          const cents = Math.round(value * 100);
          if (!allowedCents.has(cents)) forbidden.add(cents);
        }
      }
      expect(forbidden.size, "there are figures to guard against").toBeGreaterThan(6);

      // Forbidden figures must appear nowhere in the document, on any row.
      for (const cents of forbidden) {
        const printed = (cents / 100).toFixed(2);
        expect(text, `${printed} must not appear anywhere in the PDF`).not.toContain(printed);
      }

      // A refused multi-code request is not a booking, so it has no row.
      expect(text).not.toContain(REFUSED_GUEST);
    },
  );

  it("keeps the exported cells equal to the finalized amounts", () => {
    for (const c of CASES) {
      const cells = pdfPriceCells(c.row);
      const a = reportAmounts(c.row);
      if (!a.hasAmount) {
        expect(cells).toEqual({
          room: PDF_NO_AMOUNT,
          breakfast: PDF_NO_AMOUNT,
          total: PDF_NO_AMOUNT,
        });
        continue;
      }
      const room = Number(cells.room);
      const breakfast = cells.breakfast === PDF_NO_AMOUNT ? 0 : Number(cells.breakfast);
      expect(roundCents(room + breakfast), c.label).toBe(roundCents(a.charged));
      expect(Number(cells.total), c.label).toBe(roundCents(c.row.price_eur ?? 0));
      expect(room, `${c.label}: no negative room line`).toBeGreaterThanOrEqual(0);
    }
  });
});
