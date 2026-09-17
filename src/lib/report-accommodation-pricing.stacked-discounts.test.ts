import { describe, it, expect } from "vitest";
import {
  reportAmounts,
  sumReportAmounts,
  roundCents,
  type ReportPricingRow,
} from "./report-pricing-accessor";
import { csvPriceCells, parseCsvSplitCell, pdfPriceCells } from "./report-export-cells";

/**
 * Regression: several promo sources may end up on one multi-night stay, for
 * example a percentage promo code plus a fixed coupon plus a staff-made manual
 * adjustment, or a member rate combined with a seasonal campaign. Whatever the
 * stack, reports must split only the amount the guest is actually charged:
 *
 *     room line + breakfast line === charged amount   (to the cent)
 *
 * and no intermediate figure from the discount stack may leak into a report.
 */

const stay = (over: Partial<ReportPricingRow> = {}): ReportPricingRow => ({
  reservation_type: "guesthouse",
  date: "2027-02-01",
  check_out_date: "2027-02-05", // 4 nights
  guests_count: 2,
  breakfast_included: true,
  breakfast_price_per_person: 14.5,
  price_eur: null,
  ...over,
});

/** Apply a stack of promos in order and return the charged amount. */
const applyStack = (
  listPrice: number,
  steps: ({ pct: number } | { minus: number } | { setTo: number })[],
) => {
  let v = listPrice;
  for (const s of steps) {
    if ("pct" in s) v = v * (1 - s.pct);
    else if ("minus" in s) v = Math.max(0, v - s.minus);
    else v = s.setTo;
  }
  return roundCents(v);
};

const expectBalanced = (row: ReportPricingRow, label: string) => {
  const a = reportAmounts(row);
  expect(Math.round(a.room * 100) + Math.round(a.breakfast * 100), label).toBe(
    Math.round(a.charged * 100),
  );
  expect(a.room >= 0, label).toBe(true);
  expect(a.breakfast >= 0, label).toBe(true);
  expect(a.breakfast <= a.charged, label).toBe(true);
  return a;
};

describe("stacked discounts on multi-night stays", () => {
  it("splits only the final charged amount, not any step of the stack", () => {
    // 4 nights x 120 EUR + breakfast 14.5 x 2 guests x 4 nights = 596 EUR list.
    const list = roundCents(4 * 120 + 14.5 * 2 * 4);
    expect(list).toBe(596);

    // Promo code -20%, then a 50 EUR coupon, then -5% loyalty.
    const charged = applyStack(list, [{ pct: 0.2 }, { minus: 50 }, { pct: 0.05 }]);
    expect(charged).toBe(405.46);

    const a = expectBalanced(stay({ price_eur: charged }), "20% + 50 EUR + 5%");
    expect(a.charged).toBe(405.46);
    expect(a.breakfast).toBe(116); // stored rate x guests x nights
    expect(a.room).toBe(289.46);

    // None of the intermediate figures (476.80, 426.80) appear anywhere.
    const csv = csvPriceCells(stay({ price_eur: charged }), { breakfast: "Breakfast" });
    const pdf = pdfPriceCells(stay({ price_eur: charged }));
    for (const cell of [csv.price, csv.total, pdf.room, pdf.breakfast, pdf.total]) {
      expect(cell).not.toContain("476.80");
      expect(cell).not.toContain("426.80");
      expect(cell).not.toContain("596.00");
    }
    const split = parseCsvSplitCell(csv.total);
    expect(split).not.toBeNull();
    expect(roundCents(split!.room + split!.breakfast)).toBe(405.46);
  });

  it("stays balanced when a stack discounts a stay below its breakfast value", () => {
    const list = roundCents(6 * 95 + 21.5 * 4 * 6); // 6 nights, 4 guests = 1086
    // -60% campaign, then -50% partner rate, then a 120 EUR goodwill coupon.
    const charged = applyStack(list, [{ pct: 0.6 }, { pct: 0.5 }, { minus: 120 }]);
    expect(charged).toBe(97.2);

    const row = stay({
      check_out_date: "2027-02-07",
      guests_count: 4,
      breakfast_price_per_person: 21.5,
      price_eur: charged,
    });
    const a = expectBalanced(row, "stack below breakfast value");
    // Breakfast alone would be 516, so it is capped and the room line hits zero.
    expect(a.breakfast).toBe(97.2);
    expect(a.room).toBe(0);
  });

  it("reports zero for a stack that comps the whole stay", () => {
    const row = stay({ price_eur: applyStack(596, [{ pct: 0.5 }, { minus: 1000 }]) });
    const a = expectBalanced(row, "comped by stack");
    expect(a.charged).toBe(0);
    expect(a.room).toBe(0);
    expect(a.breakfast).toBe(0);
    expect(a.hasAmount).toBe(false);
  });

  it("handles a stack that ends in a manual override above the list price", () => {
    // Two promos, then staff type in a corrected total (late checkout added).
    const charged = applyStack(596, [{ pct: 0.15 }, { minus: 25 }, { setTo: 640.35 }]);
    const a = expectBalanced(stay({ price_eur: charged }), "manual override up");
    expect(a.charged).toBe(640.35);
    expect(a.breakfast).toBe(116);
    expect(a.room).toBe(524.35);
  });

  it("keeps every stacked combination balanced across many stays", () => {
    const stacks: ({ pct: number } | { minus: number } | { setTo: number })[][] = [
      [{ pct: 0.1 }, { pct: 0.07 }],
      [{ pct: 0.33 }, { minus: 19.9 }],
      [{ minus: 40 }, { pct: 0.25 }, { minus: 15.55 }],
      [{ pct: 0.5 }, { pct: 0.5 }, { pct: 0.5 }],
      [{ minus: 12.34 }, { minus: 56.78 }, { pct: 0.125 }],
      [{ pct: 0.9 }, { minus: 5 }],
      [{ pct: 0.05 }, { setTo: 499.99 }, { pct: 0.13 }],
      [{ pct: 0.999 }],
    ];
    const nightlyRates = [78.4, 129.9, 245, 89.95];
    const breakfastRates = [0, 9.9, 14.5, 21.5, 33.333];
    const nightsList = [2, 3, 5, 9, 14, 21];
    const partyList = [1, 2, 4, 7, 13];

    const rows: ReportPricingRow[] = [];
    let checked = 0;

    for (const stack of stacks) {
      for (const nightly of nightlyRates) {
        for (const rate of breakfastRates) {
          for (const nights of nightsList) {
            for (const guests of partyList) {
              const list = roundCents(nightly * nights + rate * guests * nights);
              const charged = applyStack(list, stack);
              const checkOut = new Date(Date.UTC(2027, 1, 1) + nights * 86400000)
                .toISOString()
                .slice(0, 10);
              const row = stay({
                reservation_type: guests > 6 ? "hotel" : "guesthouse",
                check_out_date: checkOut,
                guests_count: guests,
                breakfast_price_per_person: rate,
                price_eur: charged,
              });
              const label = `stack=${JSON.stringify(stack)} nightly=${nightly} rate=${rate} nights=${nights} guests=${guests}`;
              const a = expectBalanced(row, label);
              expect(a.charged, label).toBe(charged);
              rows.push(row);
              checked++;
            }
          }
        }
      }
    }

    expect(checked).toBe(stacks.length * 4 * 5 * 6 * 5);

    // The period total equals the sum of the charged amounts, to the cent.
    const totals = sumReportAmounts(rows);
    const expected = rows.reduce((sum, r) => sum + Math.round((r.price_eur ?? 0) * 100), 0);
    expect(Math.round(totals.charged * 100)).toBe(expected);
    expect(roundCents(totals.room + totals.breakfast)).toBe(totals.charged);
  });

  it("ignores a stack entirely on a menu-priced restaurant booking", () => {
    const row: ReportPricingRow = {
      reservation_type: "restaurant",
      pricing_type: "menu",
      date: "2027-02-01",
      check_out_date: null,
      guests_count: 10,
      breakfast_included: true,
      breakfast_price_per_person: 14.5,
      price_eur: applyStack(500, [{ pct: 0.2 }, { minus: 50 }]),
    };
    const a = expectBalanced(row, "menu with stacked discounts");
    expect(a.charged).toBe(0);
    expect(a.room).toBe(0);
    expect(a.breakfast).toBe(0);
  });
});
