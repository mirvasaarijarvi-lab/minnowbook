import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CSV_NO_AMOUNT,
  PRINT_NO_AMOUNT,
  csvPriceCells,
  parseCsvSplitCell,
  printPriceCells,
} from "./report-export-cells";
import {
  reportAmounts,
  roundCents,
  type ReportPricingRow,
} from "./report-pricing-accessor";

/**
 * Reads the exported data back: the CSV rows and the print-view table cells
 * are generated exactly as the report panel generates them, then parsed as a
 * spreadsheet or a reader would see them. For every stay the room line plus
 * the breakfast line must sum to the charged amount, to the cent.
 */

const LABELS = { breakfast: "Breakfast" };
const fmtEur = (v: number) =>
  v.toLocaleString("fi-FI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

/** "1 234,50 €" (Finnish print formatting) back to a number. */
const parseEur = (s: string) =>
  Number(
    s
      .replace(/\s|\u00a0|\u202f/g, "")
      .replace("€", "")
      .replace(",", "."),
  );

const parsePrintSplitCell = (cell: string) => {
  const nums = cell
    .split("<br>")
    .map((part) =>
      part
        .replace(/<[^>]+>/g, "")
        .replace(/^\+\s.*?:\s/, "")
        .trim(),
    )
    .filter(Boolean)
    .map(parseEur);
  if (nums.length !== 3) return null;
  return { room: nums[0], breakfast: nums[1], total: nums[2] };
};

const stay = (over: Partial<ReportPricingRow> = {}): ReportPricingRow => ({
  reservation_type: "guesthouse",
  date: "2026-10-01",
  check_out_date: "2026-10-04",
  guests_count: 2,
  breakfast_included: true,
  breakfast_price_per_person: 12,
  price_eur: 297,
  ...over,
});

const nightsLater = (start: string, nights: number) =>
  new Date(new Date(start + "T00:00:00Z").getTime() + nights * 86400000)
    .toISOString()
    .slice(0, 10);

/** A representative period: stays, non-accommodation and unpriced bookings. */
const buildRows = (): ReportPricingRow[] => {
  const rows: ReportPricingRow[] = [
    stay(),
    stay({
      breakfast_price_per_person: 8.95,
      guests_count: 3,
      price_eur: 383.6,
    }),
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
  ];
  for (const rate of [0.33, 11.11, 12.345, 19.99]) {
    for (const nights of [1, 2, 7, 23]) {
      for (const guests of [1, 2, 9]) {
        rows.push(
          stay({
            check_out_date: nightsLater("2026-10-01", nights),
            guests_count: guests,
            breakfast_price_per_person: rate,
            price_eur: roundCents(83.33 * nights + rate * guests * nights),
          }),
        );
      }
    }
  }
  return rows;
};

describe("exported CSV data", () => {
  it("spells out a room + breakfast split that sums to the charged amount", () => {
    const cells = csvPriceCells(stay(), LABELS);
    expect(cells.price).toBe("225.00");
    expect(cells.total).toBe("225.00 + Breakfast: 72.00 = 297.00");
    const parsed = parseCsvSplitCell(cells.total)!;
    expect(parsed.room + parsed.breakfast).toBeCloseTo(parsed.total, 10);
  });

  it("balances every stay in a whole exported period", () => {
    let roomCents = 0;
    let breakfastCents = 0;
    let chargedCents = 0;
    for (const r of buildRows()) {
      const a = reportAmounts(r);
      const cells = csvPriceCells(r, LABELS);
      const split = parseCsvSplitCell(cells.total);

      if (split) {
        // A stay with breakfast: the exported line items must add up exactly.
        expect(
          Math.round(split.room * 100) + Math.round(split.breakfast * 100),
        ).toBe(Math.round(split.total * 100));
        expect(split.total).toBeCloseTo(a.charged, 10);
        // The price column is the room line of the same split.
        expect(Number(cells.price)).toBeCloseTo(split.room, 10);
        roomCents += Math.round(split.room * 100);
        breakfastCents += Math.round(split.breakfast * 100);
        chargedCents += Math.round(split.total * 100);
      } else if (cells.total === CSV_NO_AMOUNT) {
        expect(a.hasAmount).toBe(false);
      } else {
        // No breakfast: the total column is the whole charged amount.
        expect(Number(cells.total)).toBeCloseTo(a.charged, 10);
        roomCents += Math.round(a.room * 100);
        breakfastCents += Math.round(a.breakfast * 100);
        chargedCents += Math.round(a.charged * 100);
      }
    }
    expect(roomCents + breakfastCents).toBe(chargedCents);
  });

  it("writes a placeholder, never an invented amount, when there is no price", () => {
    for (const r of [
      stay({
        reservation_type: "restaurant",
        pricing_type: "menu",
        breakfast_included: false,
        price_eur: 80,
      }),
      stay({
        reservation_type: "venue",
        breakfast_included: false,
        price_eur: null,
      }),
    ]) {
      const cells = csvPriceCells(r, LABELS);
      expect(cells.price).toBe(CSV_NO_AMOUNT);
      expect(cells.total).toBe(CSV_NO_AMOUNT);
    }
  });
});

describe("exported print data", () => {
  it("shows a room + breakfast split that sums to the charged amount", () => {
    const cells = printPriceCells(stay(), LABELS, fmtEur);
    const parsed = parsePrintSplitCell(cells.total)!;
    expect(parsed.room).toBeCloseTo(225, 10);
    expect(parsed.breakfast).toBeCloseTo(72, 10);
    expect(parsed.total).toBeCloseTo(297, 10);
    expect(
      Math.round(parsed.room * 100) + Math.round(parsed.breakfast * 100),
    ).toBe(Math.round(parsed.total * 100));
    expect(parseEur(cells.price)).toBeCloseTo(parsed.room, 10);
  });

  it("balances every stay in the printed table and matches the CSV figures", () => {
    for (const r of buildRows()) {
      const a = reportAmounts(r);
      const printCells = printPriceCells(r, LABELS, fmtEur);
      const csvCells = csvPriceCells(r, LABELS);
      const printSplit = parsePrintSplitCell(printCells.total);
      const csvSplit = parseCsvSplitCell(csvCells.total);

      if (printSplit) {
        expect(
          Math.round(printSplit.room * 100) +
            Math.round(printSplit.breakfast * 100),
        ).toBe(Math.round(printSplit.total * 100));
        expect(printSplit.total).toBeCloseTo(a.charged, 10);
        // The two exports never disagree.
        expect(csvSplit).not.toBeNull();
        expect(printSplit.room).toBeCloseTo(csvSplit!.room, 10);
        expect(printSplit.breakfast).toBeCloseTo(csvSplit!.breakfast, 10);
        expect(printSplit.total).toBeCloseTo(csvSplit!.total, 10);
      } else if (printCells.total === PRINT_NO_AMOUNT) {
        expect(a.hasAmount).toBe(false);
        expect(csvCells.total).toBe(CSV_NO_AMOUNT);
      } else {
        expect(parseEur(printCells.total)).toBeCloseTo(a.charged, 10);
      }
    }
  });
});

describe("the report panel uses the shared export cells", () => {
  it("builds CSV and print price cells only through the shared helpers", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../components/dashboard/ReportsPanel.tsx"),
      "utf8",
    );
    expect(src).toContain('from "@/lib/report-export-cells"');
    expect(src).toContain("csvPriceCells(r, {");
    expect(src).toContain("printPriceCells(");
    // No inline re-assembly of the split string in either export.
    expect(src).not.toMatch(/\+ \$\{t\("reports\.breakfast"\)\}: \$\{/);
    expect(src).not.toMatch(/toFixed\(2\)\} = \$\{/);
  });
});
