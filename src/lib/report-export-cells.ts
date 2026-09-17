/**
 * The price cells of the CSV export and the print view.
 *
 * Both exports show two money columns per booking: the room/price column and
 * the total column, where an accommodation stay with breakfast is written out
 * as "room + breakfast: x = total". Building those strings here (instead of
 * inline in the report panel) means a test can read the exported data back and
 * check that the room line and the breakfast line sum exactly to the charged
 * amount for every stay.
 */

import { reportAmounts, type ReportPricingRow } from "./report-pricing-accessor";

export interface ExportPriceCells {
  /** Room / price column. */
  price: string;
  /** Total column, possibly spelling out the room + breakfast split. */
  total: string;
}

/** Plain "1234.50" style used by the CSV export. */
const csvNum = (v: number) => v.toFixed(2);

/** Placeholder for "no amount" in the CSV export. */
export const CSV_NO_AMOUNT = "-";

/** Placeholder for "no amount" in the print view. */
export const PRINT_NO_AMOUNT = "—";

export const csvPriceCells = (
  r: ReportPricingRow,
  labels: { breakfast: string },
): ExportPriceCells => {
  const { charged, room, breakfast, isAccommodation, hasAmount } = reportAmounts(r);
  // A booking with no amount shows a placeholder in both exports, never 0.00,
  // so a spreadsheet cannot read "priced at zero" where staff still owe a price.
  if (!hasAmount) return { price: CSV_NO_AMOUNT, total: CSV_NO_AMOUNT };
  if (isAccommodation) {
    return {
      price: csvNum(room),
      total:
        breakfast > 0
          ? `${csvNum(room)} + ${labels.breakfast}: ${csvNum(breakfast)} = ${csvNum(charged)}`
          : csvNum(charged),
    };
  }
  return { price: csvNum(charged), total: csvNum(charged) };
};

export const printPriceCells = (
  r: ReportPricingRow,
  labels: { breakfast: string },
  fmtEur: (v: number) => string,
): ExportPriceCells => {
  const { charged, room, breakfast, isAccommodation, hasAmount } = reportAmounts(r);
  const price = isAccommodation
    ? fmtEur(room)
    : hasAmount
      ? fmtEur(charged)
      : PRINT_NO_AMOUNT;
  const total =
    isAccommodation && breakfast > 0 && hasAmount
      ? `<span style="white-space:nowrap">${fmtEur(room)}</span><br><span style="font-size:0.7rem;color:#666">+ ${labels.breakfast}: ${fmtEur(breakfast)}</span><br><strong>${fmtEur(charged)}</strong>`
      : hasAmount
        ? fmtEur(charged)
        : PRINT_NO_AMOUNT;
  return { price, total };
};

/** Parse "225.00 + Breakfast: 72.00 = 297.00" back into its parts. */
export const parseCsvSplitCell = (
  cell: string,
): { room: number; breakfast: number; total: number } | null => {
  const m = cell.match(
    /^(-?\d+(?:\.\d+)?)\s\+\s.+?:\s(-?\d+(?:\.\d+)?)\s=\s(-?\d+(?:\.\d+)?)$/,
  );
  if (!m) return null;
  return { room: Number(m[1]), breakfast: Number(m[2]), total: Number(m[3]) };
};
