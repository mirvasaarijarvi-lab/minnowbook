import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import {
  calcBreakfastPrice,
  calcRoomPrice,
  effectiveChargedTotal,
  roundCents,
} from "@/lib/report-accommodation-pricing";
import { reportAmounts, sumReportAmounts } from "@/lib/report-pricing-accessor";
import {
  csvPriceCells,
  printPriceCells,
  pdfPriceCells,
  parseCsvSplitCell,
  CSV_NO_AMOUNT,
  PRINT_NO_AMOUNT,
  PDF_NO_AMOUNT,
} from "@/lib/report-export-cells";

/**
 * End-to-end: awkward discount percentages always land on the same cent, in
 * every persisted report view.
 *
 * Covers the edges where rounding usually breaks:
 *   - 0 % (a code that discounts nothing)
 *   - 0.01 % and other part-cent percentages (7.77 %, 12.345 %, 33.333 %)
 *   - near-100 % (99.99 %) and exactly 100 % (a comped stay)
 *   - fixed coupons a cent below and far above the stay's total
 *
 * The stay itself is deliberately awkward: 83.33 EUR per night for 3 nights
 * plus 6.67 EUR breakfast for 3 guests, so the gross (310.02 EUR) does not
 * divide cleanly by anything.
 *
 * For every case the spec asserts that the stored total equals the server's
 * own rounding to the cent, and that the same cent appears in the on-screen
 * figures, the CSV split, the print view and the PDF columns, with the room
 * line plus the breakfast line equal to the charged amount and the period
 * total equal to the sum of the rows.
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so CI
 * never blocks on missing secrets.
 */

const NIGHTLY_EUR = 83.33;
const BREAKFAST_EUR = 6.67;
const NIGHTS = 3;
const GUESTS = 3;
const GROSS_EUR = roundCents(NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS); // 310.02

interface Case {
  label: string;
  type: "percentage" | "fixed";
  value: number;
}

const CASES: Case[] = [
  { label: "zero percent", type: "percentage", value: 0 },
  { label: "one hundredth of a percent", type: "percentage", value: 0.01 },
  { label: "part cent percent 7.77", type: "percentage", value: 7.77 },
  { label: "part cent percent 12.345", type: "percentage", value: 12.345 },
  { label: "one third percent 33.333", type: "percentage", value: 33.333 },
  { label: "near one hundred percent", type: "percentage", value: 99.99 },
  { label: "exactly one hundred percent", type: "percentage", value: 100 },
  { label: "fixed one cent below the total", type: "fixed", value: GROSS_EUR - 0.01 },
  { label: "fixed above the total", type: "fixed", value: GROSS_EUR + 500 },
  { label: "fixed awkward amount", type: "fixed", value: 33.335 },
];

/** Same arithmetic and rounding the server applies. */
function expectedFinal(c: Case): number {
  // A fixed coupon worth more than the stay is refused as inconsistent data by
  // the database safeguard: the discount is cleared and the guest owes the
  // full amount, never a value derived from the malformed payload.
  if (c.type === "fixed" && c.value > GROSS_EUR) return GROSS_EUR;
  const raw =
    c.type === "percentage"
      ? Math.max(0, GROSS_EUR * (1 - c.value / 100))
      : Math.max(0, GROSS_EUR - c.value);
  return Math.round(raw * 100) / 100;
}

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Discount rounding edge cases", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("always round to the same cent in every persisted report", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    const post = (data: Record<string, unknown>) =>
      request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        data,
        timeout: 30_000,
      });

    // 1. One awkwardly priced room.
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Rounding Guesthouse ${stamp}`,
        resource_type: "guesthouse",
        capacity: 30,
        price_per_night: NIGHTLY_EUR,
        breakfast_price_per_person: BREAKFAST_EUR,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();

    // 2. One code per edge case.
    const codeRows = CASES.map((c, i) => ({
      tenant_id: tenantId,
      code: `CIROUND${i}${stamp}`,
      discount_type: c.type,
      discount_value: c.value,
      is_active: true,
    }));
    const { data: codes, error: codesErr } = await admin
      .from("discount_codes")
      .insert(codeRows)
      .select("id, code, discount_value, discount_type");
    expect(codesErr, codesErr?.message).toBeNull();
    expect(codes).toHaveLength(CASES.length);

    // 3. One booking per case, each on its own date and guest email so the
    //    retry de-duplication never merges two cases.
    const stored: Array<{ label: string; expected: number; row: Record<string, unknown> }> = [];

    for (const [i, c] of CASES.entries()) {
      const code = codes!.find((x) => x.code === `CIROUND${i}${stamp}`)!;
      const guestEmail = `ci+round-${i}-${stamp}@mimmobook.test`;
      const res = await post({
        tenant_id: tenantId,
        reservation_type: "guesthouse",
        resource_id: resource!.id,
        date: isoDate(150 + i * 4),
        check_out_date: isoDate(150 + i * 4 + NIGHTS),
        guests_count: GUESTS,
        breakfast_included: true,
        guest_name: `TEST CI Rounding ${c.label} ${stamp}`,
        guest_email: guestEmail,
        guest_phone: "+358401234567",
        promo_code: code.code,
        special_requests: "Created by the discount rounding E2E spec.",
      });
      expect(res.status(), `${c.label}: ${await res.text()}`).toBe(200);

      const { data: rows, error: rowsErr } = await admin
        .from("reservations")
        .select(
          "id, reservation_type, pricing_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, price_eur, original_price_eur, discount_type, discount_value, discount_code_id",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", guestEmail);
      expect(rowsErr, rowsErr?.message).toBeNull();
      expect(rows, `${c.label} stored the wrong number of bookings`).toHaveLength(1);

      const row = rows![0];
      expect(Number(row.original_price_eur), `${c.label} gross`).toBe(GROSS_EUR);
      expect(Number(row.price_eur), `${c.label} charged total`).toBe(expectedFinal(c));
      // A code worth nothing (0 %) is recorded as no discount at all: the
      // booking simply carries the full price, with no discount fields set.
      if (c.value === 0) {
        expect(row.discount_code_id, `${c.label} should store no discount`).toBeNull();
        expect(Number(row.price_eur)).toBe(GROSS_EUR);
      } else {
        expect(row.discount_code_id, `${c.label} discount code`).toBe(code.id);
      }
      stored.push({ label: c.label, expected: expectedFinal(c), row: row as Record<string, unknown> });
    }

    // 4. Every view agrees on the same cent.
    const reportRows = stored.map((s) => ({
      reservation_type: s.row.reservation_type as string,
      pricing_type: s.row.pricing_type as string | null,
      date: s.row.date as string,
      check_out_date: s.row.check_out_date as string,
      guests_count: s.row.guests_count as number,
      breakfast_included: s.row.breakfast_included as boolean,
      breakfast_price_per_person: Number(s.row.breakfast_price_per_person),
      price_eur: Number(s.row.price_eur),
    }));

    const LABELS = { breakfast: "Breakfast" };
    const fmtEur = (v: number) => `${v.toFixed(2)} EUR`;

    let totalCents = 0;
    reportRows.forEach((r, i) => {
      const label = stored[i].label;
      const expected = stored[i].expected;
      const hasAmount = expected > 0;

      // Shared accessor: the single source of truth for report money.
      const amounts = reportAmounts(r);
      expect(roundCents(amounts.charged), `${label} accessor charged`).toBe(expected);
      expect(roundCents(amounts.room + amounts.breakfast), `${label} accessor split`).toBe(
        expected,
      );
      expect(amounts.hasAmount, `${label} hasAmount`).toBe(hasAmount);

      // Lower level helpers agree with the accessor whenever there is money.
      if (hasAmount) {
        expect(roundCents(effectiveChargedTotal(r)), `${label} charged helper`).toBe(expected);
        expect(roundCents(calcRoomPrice(r) + calcBreakfastPrice(r)), `${label} helper split`).toBe(
          expected,
        );
      }

      const csv = csvPriceCells(r, LABELS);
      const print = printPriceCells(r, LABELS, fmtEur);
      const pdf = pdfPriceCells(r);

      if (!hasAmount) {
        // A fully comped stay shows a placeholder, never 0.00, so a spreadsheet
        // cannot read it as a genuine zero-euro charge.
        expect(csv.total, `${label} CSV total`).toBe(CSV_NO_AMOUNT);
        expect(csv.price, `${label} CSV price`).toBe(CSV_NO_AMOUNT);
        expect(print.total, `${label} print total`).toBe(PRINT_NO_AMOUNT);
        expect(pdf.total, `${label} PDF total`).toBe(PDF_NO_AMOUNT);
        expect(pdf.room, `${label} PDF room`).toBe(PDF_NO_AMOUNT);
        expect(pdf.breakfast, `${label} PDF breakfast`).toBe(PDF_NO_AMOUNT);
        return;
      }

      // CSV: when a split is spelled out it parses back to the same cents.
      const parsed = parseCsvSplitCell(csv.total);
      if (amounts.breakfast > 0) {
        expect(parsed, `${label} CSV split unparseable: ${csv.total}`).not.toBeNull();
        expect(roundCents(parsed!.room + parsed!.breakfast), `${label} CSV split`).toBe(expected);
        expect(roundCents(parsed!.total), `${label} CSV total`).toBe(expected);
      } else {
        expect(csv.total, `${label} CSV total`).toBe(expected.toFixed(2));
      }
      expect(csv.price, `${label} CSV room cell`).toBe(amounts.room.toFixed(2));

      // PDF columns: room + breakfast = total, on the printed strings.
      expect(pdf.total, `${label} PDF total`).toBe(expected.toFixed(2));
      expect(pdf.room, `${label} PDF room`).toBe(amounts.room.toFixed(2));
      const pdfBreakfast = pdf.breakfast === PDF_NO_AMOUNT ? 0 : Number(pdf.breakfast);
      expect(roundCents(Number(pdf.room) + pdfBreakfast), `${label} PDF split`).toBe(expected);

      // Print view carries the very same cents.
      expect(print.total, `${label} print total`).toContain(fmtEur(expected));
      expect(print.price, `${label} print room cell`).toBe(fmtEur(amounts.room));

      // Never negative, never above the gross.
      expect(amounts.room).toBeGreaterThanOrEqual(0);
      expect(amounts.breakfast).toBeGreaterThanOrEqual(0);
      expect(roundCents(amounts.charged)).toBeLessThanOrEqual(GROSS_EUR);

      totalCents += Math.round(expected * 100);
    });

    // 5. Period total equals the sum of the rows, to the cent.
    const period = sumReportAmounts(reportRows);
    expect(Math.round(period.charged * 100)).toBe(totalCents);
    expect(Math.round((period.room + period.breakfast) * 100)).toBe(totalCents);

    // 6. The extremes behave as policy expects.
    const zero = stored.find((s) => s.label === "zero percent")!;
    expect(Number(zero.row.price_eur)).toBe(GROSS_EUR);
    const comped = stored.find((s) => s.label === "exactly one hundred percent")!;
    expect(Number(comped.row.price_eur)).toBe(0);
    const overFixed = stored.find((s) => s.label === "fixed above the total")!;
    expect(Number(overFixed.row.price_eur)).toBe(GROSS_EUR);
    expect(overFixed.row.discount_type, "an over-sized coupon must be cleared").toBeNull();
    const oneCent = stored.find((s) => s.label === "fixed one cent below the total")!;
    expect(Number(oneCent.row.price_eur)).toBe(0.01);
  });
});
