import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  reportAmounts,
  sumReportAmounts,
  roundCents,
  type ReportPricingRow,
} from "./report-pricing-accessor";

/**
 * The accessor is the only way a report view may read money, and this file
 * fails if any view (on-screen table, CSV, print, PDF, KPI cards, totals)
 * recomputes amounts on its own.
 */

const REPORT_VIEWS = ["src/components/dashboard/ReportsPanel.tsx"];

const readSource = (rel: string) =>
  readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

const stay = (over: Partial<ReportPricingRow> = {}): ReportPricingRow => ({
  reservation_type: "guesthouse",
  date: "2026-09-01",
  check_out_date: "2026-09-04",
  guests_count: 2,
  breakfast_included: true,
  breakfast_price_per_person: 12,
  price_eur: 297,
  ...over,
});

describe("reportAmounts: the single pricing accessor", () => {
  it("splits an accommodation stay so room + breakfast equals the charged amount", () => {
    const a = reportAmounts(stay());
    expect(a.charged).toBe(297);
    expect(a.room).toBe(225);
    expect(a.breakfast).toBe(72);
    expect(a.nights).toBe(3);
    expect(a.isAccommodation).toBe(true);
    expect(a.hasAmount).toBe(true);
    expect(roundCents(a.room + a.breakfast)).toBe(a.charged);
  });

  it("treats a non-accommodation booking as one room-line amount", () => {
    const a = reportAmounts(
      stay({ reservation_type: "venue", price_eur: 450 }),
    );
    expect(a.charged).toBe(450);
    expect(a.room).toBe(450);
    expect(a.breakfast).toBe(0);
    expect(a.isAccommodation).toBe(false);
  });

  it("gives a menu-priced restaurant booking no amount and no split", () => {
    const a = reportAmounts(
      stay({
        reservation_type: "restaurant",
        pricing_type: "menu",
        price_eur: 80,
      }),
    );
    expect(a.charged).toBe(0);
    expect(a.room).toBe(0);
    expect(a.breakfast).toBe(0);
    expect(a.hasAmount).toBe(false);
  });

  it("gives an unpriced booking zeros instead of guessing", () => {
    const a = reportAmounts(stay({ price_eur: null }));
    expect(a.charged).toBe(0);
    expect(a.room).toBe(0);
    expect(a.breakfast).toBe(0);
    expect(a.hasAmount).toBe(false);
  });

  it("sums a period in cents so the total never drifts from its rows", () => {
    const rows = [
      stay(),
      stay({
        breakfast_price_per_person: 8.95,
        guests_count: 3,
        price_eur: 383.6,
      }),
      stay({ breakfast_price_per_person: null, price_eur: 315 }),
      stay({
        reservation_type: "restaurant",
        pricing_type: "menu",
        price_eur: 80,
      }),
      stay({
        reservation_type: "venue",
        breakfast_included: false,
        price_eur: 450,
      }),
      stay({ price_eur: null }),
    ];
    const totals = sumReportAmounts(rows);
    expect(totals.count).toBe(rows.length);
    expect(roundCents(totals.room + totals.breakfast)).toBe(totals.charged);
    expect(totals.charged).toBe(roundCents(297 + 383.6 + 315 + 450));
    // Row by row and in total, the same figures.
    const perRow = rows.reduce((s, r) => s + reportAmounts(r).charged, 0);
    expect(roundCents(perRow)).toBe(totals.charged);
  });

  it("stays cents-exact across awkward rates, long stays and big parties", () => {
    for (const rate of [0.33, 8.95, 11.11, 12.345, 19.99]) {
      for (const nights of [1, 3, 17, 45]) {
        for (const guests of [1, 4, 33]) {
          const checkOut = new Date(Date.UTC(2026, 8, 1) + nights * 86400000)
            .toISOString()
            .slice(0, 10);
          const charged = roundCents(83.33 * nights + rate * guests * nights);
          const a = reportAmounts(
            stay({
              check_out_date: checkOut,
              guests_count: guests,
              breakfast_price_per_person: rate,
              price_eur: charged,
            }),
          );
          expect(roundCents(a.room + a.breakfast)).toBe(a.charged);
        }
      }
    }
  });
});

describe("no report view recomputes amounts", () => {
  it("every report view imports money only from the accessor", () => {
    for (const rel of REPORT_VIEWS) {
      const src = readSource(rel);
      expect(src, rel).toContain('from "@/lib/report-pricing-accessor"');
      expect(src, rel).toContain("reportAmounts");
      // The lower-level split helpers are the accessor's business only.
      expect(src, rel).not.toContain("report-accommodation-pricing");
      for (const banned of [
        "calcRoomPrice as",
        "calcBreakfastPrice as",
        "effectiveChargedTotal",
        "calcChargedTotal",
        "DEFAULT_BREAKFAST_PRICE_PER_PERSON",
      ]) {
        expect(src.includes(banned), `${rel} must not use ${banned}`).toBe(
          false,
        );
      }
    }
  });

  it("no report view does its own arithmetic on stored prices", () => {
    // Patterns that previously caused one surface to disagree with another:
    // a local price fallback, re-multiplying by nights, or adding breakfast on
    // top of a total that already includes it.
    const banned: Array<[RegExp, string]> = [
      [/price_eur\s*\?\?\s*0/, "local price_eur fallback"],
      [/original_price_eur\s*\?\?\s*0/, "local original_price_eur fallback"],
      [/price_eur\s*[*/]/, "arithmetic on price_eur"],
      [/[*/]\s*r\.price_eur/, "arithmetic on price_eur"],
      [/calcNights\([^)]*\)\s*\*/, "multiplying by nights"],
      [/\*\s*calcNights/, "multiplying by nights"],
      [/breakfast_price_per_person\s*[*]/, "recomputing breakfast"],
      [
        /reduce\([^)]*effectivePrice/,
        "summing prices outside sumReportAmounts",
      ],
      [
        /reduce\([^)]*calcRoomPrice/,
        "summing room lines outside sumReportAmounts",
      ],
      [
        /reduce\([^)]*calcBreakfastPrice/,
        "summing breakfast outside sumReportAmounts",
      ],
    ];
    for (const rel of REPORT_VIEWS) {
      const src = readSource(rel);
      for (const [pattern, why] of banned) {
        expect(
          pattern.test(src),
          `${rel} must not contain ${why} (${pattern})`,
        ).toBe(false);
      }
    }
  });

  it("the accessor itself is the only place the split helpers are used", () => {
    const accessor = readSource("src/lib/report-pricing-accessor.ts");
    expect(accessor).toContain('from "./report-accommodation-pricing"');
    expect(accessor).toContain("export const reportAmounts");
    expect(accessor).toContain("export const sumReportAmounts");
  });
});
