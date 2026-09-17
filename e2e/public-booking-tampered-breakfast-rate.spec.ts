import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { randomUUID } from "node:crypto";
import {
  calcBreakfastPrice,
  calcRoomPrice,
  roundCents,
} from "@/lib/report-accommodation-pricing";

/**
 * End-to-end: the server ignores any breakfast rate a guest's browser sends and
 * always recalculates the room and breakfast amounts from the tenant's resource
 * configuration.
 *
 * Cases locked here (all against the live `public-booking` function):
 *
 *   1. Client claims a 0.01 EUR breakfast rate  -> resource rate used
 *   2. Client claims a 250 EUR breakfast rate   -> resource rate used
 *   3. Client sends NaN / negative / string rates -> resource rate used
 *   4. Breakfast not taken, client still sends a rate -> no breakfast charged
 *   5. Resource with no breakfast rate configured -> nothing invented, no rate
 *      stored, and the room amount stays the nightly price only
 *   6. Client claims a totally different nightly price and total -> ignored
 *
 * Every stored booking is also checked against the report split, so the room
 * and breakfast lines add up to the amount the guest is charged, to the cent.
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so CI
 * never blocks on missing secrets.
 */

const NIGHTLY_EUR = 96.5;
const RESOURCE_BREAKFAST_EUR = 13.75;
const NIGHTS = 3;
const GUESTS = 4;
const EXPECTED_TOTAL = roundCents(
  NIGHTLY_EUR * NIGHTS + RESOURCE_BREAKFAST_EUR * GUESTS * NIGHTS,
); // 289.50 + 165.00 = 454.50
const NO_BREAKFAST_TOTAL = roundCents(NIGHTLY_EUR * NIGHTS); // 289.50
/** Fallback rate the server uses when a resource has no rate configured. */
const FALLBACK_BREAKFAST_EUR = 15;
const FALLBACK_TOTAL = roundCents(
  NIGHTLY_EUR * NIGHTS + FALLBACK_BREAKFAST_EUR * GUESTS * NIGHTS,
); // 289.50 + 180.00 = 469.50

/** Breakfast/pricing figures a tampered client might append to a request. */
const TAMPERED_TOTALS = {
  price_eur: 1,
  original_price_eur: 1,
  final_price_eur: 1,
  total_price: 1,
  price_per_night: 1,
  room_price_eur: 1,
} as const;

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Server recalculates breakfast from resource rules, ignoring the client", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("uses the resource breakfast rate whatever the browser claims", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin: service, tenantId } = ephemeralTenant;
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

    // ── Tenant configuration: the only legitimate source of money ──────
    const { data: withRate, error: withRateErr } = await service
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Breakfast Guesthouse ${stamp}`,
        resource_type: "guesthouse",
        capacity: 8,
        price_per_night: NIGHTLY_EUR,
        breakfast_price_per_person: RESOURCE_BREAKFAST_EUR,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(withRateErr, withRateErr?.message).toBeNull();

    // A second room with no breakfast rate configured at all.
    const { data: noRate, error: noRateErr } = await service
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Breakfast NoRate ${stamp}`,
        resource_type: "guesthouse",
        capacity: 8,
        price_per_night: NIGHTLY_EUR,
        breakfast_price_per_person: null,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(noRateErr, noRateErr?.message).toBeNull();

    let dayOffset = 40;
    const booking = (
      label: string,
      extra: Record<string, unknown> = {},
      resourceId: string = withRate!.id,
    ) => {
      const start = (dayOffset += NIGHTS + 2);
      return {
        tenant_id: tenantId,
        reservation_type: "guesthouse",
        resource_id: resourceId,
        date: isoDate(start),
        check_out_date: isoDate(start + NIGHTS),
        guests_count: GUESTS,
        breakfast_included: true,
        guest_name: `TEST CI Breakfast ${label} ${stamp}`,
        guest_email: `ci+breakfast-${label}-${stamp}@mimmobook.test`,
        guest_phone: "+358401234567",
        special_requests: "Created by the tampered-breakfast-rate E2E spec.",
        ...TAMPERED_TOTALS,
        ...extra,
      };
    };

    const readRow = async (label: string) => {
      const { data, error } = await service
        .from("reservations")
        .select(
          "id, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, price_eur, original_price_eur, discount_type, discount_value, is_invoiced, status",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", `ci+breakfast-${label}-${stamp}@mimmobook.test`);
      expect(error, error?.message).toBeNull();
      expect(data, `booking "${label}" was not stored`).toHaveLength(1);
      return data![0] as Record<string, unknown>;
    };

    /** The stored amount is exactly what reports split, to the cent. */
    const expectReportSplitMatches = (row: Record<string, unknown>, label: string) => {
      const reportRow = {
        reservation_type: row.reservation_type as string,
        date: row.date as string,
        check_out_date: row.check_out_date as string,
        guests_count: row.guests_count as number,
        breakfast_included: row.breakfast_included as boolean,
        breakfast_price_per_person:
          row.breakfast_price_per_person == null
            ? null
            : Number(row.breakfast_price_per_person),
        price_eur: Number(row.price_eur),
      };
      const room = calcRoomPrice(reportRow);
      const breakfast = calcBreakfastPrice(reportRow);
      expect(roundCents(room + breakfast), `${label}: split must equal the charge`).toBe(
        roundCents(Number(row.price_eur)),
      );
      return { room, breakfast };
    };

    // ── 1. Client claims an almost-free breakfast ──────────────────────
    const cheap = await post(
      booking("cheap", { breakfast_price_per_person: 0.01, breakfast_price: 0.01 }),
    );
    expect(cheap.status(), await cheap.text()).toBe(200);
    const cheapRow = await readRow("cheap");
    expect(Number(cheapRow.breakfast_price_per_person)).toBe(RESOURCE_BREAKFAST_EUR);
    expect(Number(cheapRow.price_eur)).toBe(EXPECTED_TOTAL);
    expect(Number(cheapRow.original_price_eur)).toBe(EXPECTED_TOTAL);
    expect(cheapRow.is_invoiced).toBe(false);
    expect(cheapRow.status).toBe("pending");
    const cheapSplit = expectReportSplitMatches(cheapRow, "cheap");
    expect(cheapSplit.breakfast).toBe(
      roundCents(RESOURCE_BREAKFAST_EUR * GUESTS * NIGHTS),
    );
    expect(cheapSplit.room).toBe(roundCents(NIGHTLY_EUR * NIGHTS));

    // ── 2. Client claims an inflated breakfast rate ─────────────────────
    const inflated = await post(
      booking("inflated", { breakfast_price_per_person: 250, price_eur: 9999 }),
    );
    expect(inflated.status(), await inflated.text()).toBe(200);
    const inflatedRow = await readRow("inflated");
    expect(Number(inflatedRow.breakfast_price_per_person)).toBe(RESOURCE_BREAKFAST_EUR);
    expect(Number(inflatedRow.price_eur)).toBe(EXPECTED_TOTAL);
    expectReportSplitMatches(inflatedRow, "inflated");

    // ── 3. Junk rates: NaN, negative, string ───────────────────────────
    const junkPayloads: Array<[string, unknown]> = [
      ["nan", "NaN"],
      ["negative", -50],
      ["string", "13750"],
      ["null", null],
    ];
    for (const [label, value] of junkPayloads) {
      const res = await post(
        booking(`junk-${label}`, { breakfast_price_per_person: value }),
      );
      expect(res.status(), await res.text()).toBe(200);
      const row = await readRow(`junk-${label}`);
      expect(
        Number(row.breakfast_price_per_person),
        `junk rate "${label}" leaked into the booking`,
      ).toBe(RESOURCE_BREAKFAST_EUR);
      expect(Number(row.price_eur)).toBe(EXPECTED_TOTAL);
      expectReportSplitMatches(row, `junk-${label}`);
    }

    // ── 4. Breakfast not taken, but a rate is sent anyway ──────────────
    const noBreakfast = await post(
      booking("nobreakfast", {
        breakfast_included: false,
        breakfast_price_per_person: 40,
      }),
    );
    expect(noBreakfast.status(), await noBreakfast.text()).toBe(200);
    const noBreakfastRow = await readRow("nobreakfast");
    expect(noBreakfastRow.breakfast_included).toBe(false);
    expect(Number(noBreakfastRow.price_eur)).toBe(NO_BREAKFAST_TOTAL);
    const nbSplit = expectReportSplitMatches(noBreakfastRow, "nobreakfast");
    expect(nbSplit.breakfast).toBe(0);
    expect(nbSplit.room).toBe(NO_BREAKFAST_TOTAL);

    // ── 5. Resource with no breakfast rate: the server's own fallback ──
    // The claimed 30 EUR is still ignored: the booking is priced with the
    // standard 15 EUR fallback, and the stored rate matches it so reports
    // split the same figure.
    const unconfigured = await post(
      booking("unconfigured", { breakfast_price_per_person: 30 }, noRate!.id),
    );
    expect(unconfigured.status(), await unconfigured.text()).toBe(200);
    const unconfiguredRow = await readRow("unconfigured");
    expect(Number(unconfiguredRow.breakfast_price_per_person)).toBe(
      FALLBACK_BREAKFAST_EUR,
    );
    expect(Number(unconfiguredRow.price_eur)).toBe(FALLBACK_TOTAL);
    const unconfiguredSplit = expectReportSplitMatches(unconfiguredRow, "unconfigured");
    expect(unconfiguredSplit.breakfast).toBe(
      roundCents(FALLBACK_BREAKFAST_EUR * GUESTS * NIGHTS),
    );
    expect(unconfiguredSplit.room).toBe(NO_BREAKFAST_TOTAL);

    // ── 6. A tampered nightly price and total change nothing ───────────
    const tampered = await post(
      booking("tampered", {
        price_per_night: 5,
        price_eur: 15,
        original_price_eur: 15,
        total_price: 15,
        breakfast_price_per_person: 0,
        discount_type: "percentage",
        discount_value: 99,
        discount_reason: "Promo code: SELFGRANTED99",
        discount_code_id: randomUUID(),
        is_invoiced: true,
      }),
    );
    expect(tampered.status(), await tampered.text()).toBe(200);
    const tamperedRow = await readRow("tampered");
    expect(Number(tamperedRow.breakfast_price_per_person)).toBe(RESOURCE_BREAKFAST_EUR);
    expect(Number(tamperedRow.price_eur)).toBe(EXPECTED_TOTAL);
    expect(Number(tamperedRow.original_price_eur)).toBe(EXPECTED_TOTAL);
    expect(tamperedRow.discount_type).toBeNull();
    expect(tamperedRow.discount_value).toBeNull();
    expect(tamperedRow.is_invoiced).toBe(false);
    expectReportSplitMatches(tamperedRow, "tampered");

    // ── Period view: totals are built from the recalculated amounts ─────
    const { data: allRows, error: allErr } = await service
      .from("reservations")
      .select("price_eur, breakfast_price_per_person")
      .eq("tenant_id", tenantId)
      .like("guest_email", `ci+breakfast-%-${stamp}@mimmobook.test`);
    expect(allErr, allErr?.message).toBeNull();
    // 4 junk + cheap + inflated + tampered at the full total, plus the two
    // bookings without breakfast money.
    const fullTotalCount = allRows!.filter(
      (r) => Number(r.price_eur) === EXPECTED_TOTAL,
    ).length;
    const roomOnlyCount = allRows!.filter(
      (r) => Number(r.price_eur) === NO_BREAKFAST_TOTAL,
    ).length;
    expect(fullTotalCount).toBe(7);
    expect(roomOnlyCount).toBe(2);
    expect(allRows).toHaveLength(9);
  });
});
