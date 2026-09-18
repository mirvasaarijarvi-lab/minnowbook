import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  sumReportAmounts,
  roundCents,
  type ReportPricingRow,
} from "@/lib/report-pricing-accessor";

/**
 * End-to-end: period aggregates move only when invoicing actually succeeds.
 *
 * The period report shows two kinds of figures: everything booked in the
 * period, and the invoiced part of it. A refused invoicing attempt, or an
 * attempt that tries to slip a different amount through, must leave BOTH
 * untouched:
 *
 *   1. Baseline: booked totals from the server-recalculated amounts, nothing
 *      invoiced yet.
 *   2. Refused attempts leave every figure identical, byte for byte:
 *        - a booking with no amount at all
 *        - an amount with fractions of a cent
 *        - an amount that does not cover the breakfast lines
 *        - a repeat attempt that tries to raise an already invoiced amount
 *          below its breakfast total
 *      After each one: booked total, invoiced total, room/breakfast split and
 *      counts are unchanged, and the row is still uninvoiced.
 *   3. A successful invoicing moves the invoiced total by exactly that
 *      booking's charged amount and leaves the booked total alone.
 *   4. Repeating a successful invoicing does not move anything again.
 *   5. Cancelling out (uninvoicing) moves the invoiced figure back down by the
 *      same amount, so the aggregates never drift.
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

const AMOUNT_ERROR =
  "Invoice amount must match the recalculated room and breakfast totals.";
const NO_PRICE_ERROR =
  "Add a price before marking this reservation as invoiced.";

const NIGHTLY = 140;
const BREAKFAST_RATE = 13.75;
const NIGHTS = 2;
const GUESTS = 3;
const STAY_TOTAL = NIGHTLY * NIGHTS + BREAKFAST_RATE * GUESTS * NIGHTS; // 280 + 82.50
const SECOND_STAY_TOTAL = NIGHTLY * NIGHTS + BREAKFAST_RATE * 2 * NIGHTS; // 280 + 55
const DINNER_TOTAL = 178.35;

const REPORT_COLS =
  "id, is_invoiced, price_eur, original_price_eur, reservation_type, date, check_out_date, guests_count, estimated_guests, breakfast_included, breakfast_price_per_person, pricing_type";

const isoDate = (daysFromNow: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

test.describe("Period aggregates and invoicing", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(
    !SUPABASE_ANON_KEY,
    "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.",
  );

  test("move only when invoicing succeeds, never on a refused or tampered attempt", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    const { error: resErr } = await admin.from("resources").insert([
      {
        tenant_id: tenantId,
        name: `TEST CI Aggregate Room ${stamp}`,
        resource_type: "guesthouse",
        capacity: 8,
        price_per_night: NIGHTLY,
        breakfast_price_per_person: BREAKFAST_RATE,
        is_active: true,
        approval_status: "approved",
        offers_table_reservation: false,
      },
      {
        tenant_id: tenantId,
        name: `TEST CI Aggregate Table ${stamp}`,
        resource_type: "restaurant",
        capacity: 40,
        is_active: true,
        approval_status: "approved",
        offers_table_reservation: true,
      },
    ]);
    expect(resErr, resErr?.message).toBeNull();

    const book = async (data: Record<string, unknown>) => {
      const res = await request.post(
        `${SUPABASE_URL}/functions/v1/public-booking`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          data: { tenant_id: tenantId, ...data },
          timeout: 30_000,
        },
      );
      expect(res.status(), await res.text()).toBe(200);
    };

    const stayEmail = `ci+agg-stay-${stamp}@mimmobook.test`;
    const stay2Email = `ci+agg-stay2-${stamp}@mimmobook.test`;
    const dinnerEmail = `ci+agg-dinner-${stamp}@mimmobook.test`;

    await book({
      reservation_type: "guesthouse",
      date: isoDate(380),
      check_out_date: isoDate(380 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Aggregate Stay ${stamp}`,
      guest_email: stayEmail,
      guest_phone: "+358401234567",
      special_requests: "Created by the period aggregates E2E spec.",
    });
    await book({
      reservation_type: "guesthouse",
      date: isoDate(384),
      check_out_date: isoDate(384 + NIGHTS),
      guests_count: 2,
      breakfast_included: true,
      guest_name: `TEST CI Aggregate Stay Two ${stamp}`,
      guest_email: stay2Email,
      guest_phone: "+358401234567",
      special_requests: "Created by the period aggregates E2E spec.",
    });
    await book({
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      date: isoDate(382),
      start_time: "19:00",
      guests_count: 4,
      guest_name: `TEST CI Aggregate Dinner ${stamp}`,
      guest_email: dinnerEmail,
      guest_phone: "+358401234567",
      special_requests: "Created by the period aggregates E2E spec.",
    });

    const rowFor = async (email: string) => {
      const { data, error } = await admin
        .from("reservations")
        .select(REPORT_COLS)
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      expect(error, error?.message).toBeNull();
      expect(data, `one booking for ${email}`).toHaveLength(1);
      return data![0] as Record<string, any>;
    };

    /** The whole period as a report would read it: booked and invoiced. */
    const aggregates = async () => {
      const { data, error } = await admin
        .from("reservations")
        .select(REPORT_COLS)
        .eq("tenant_id", tenantId)
        .gte("date", isoDate(370))
        .lte("date", isoDate(400));
      expect(error, error?.message).toBeNull();
      const rows = (data ?? []) as unknown as ReportPricingRow[];
      const invoicedRows = rows.filter((r) => (r as any).is_invoiced === true);
      return {
        booked: sumReportAmounts(rows),
        invoiced: sumReportAmounts(invoicedRows),
        invoicedCount: invoicedRows.length,
      };
    };

    const stay = await rowFor(stayEmail);
    const stay2 = await rowFor(stay2Email);
    const dinner = await rowFor(dinnerEmail);
    expect(
      Number(stay.price_eur),
      "stay total recalculated by the server",
    ).toBe(STAY_TOTAL);
    expect(Number(stay2.price_eur), "second stay total").toBe(
      SECOND_STAY_TOTAL,
    );
    expect(dinner.price_eur, "dine-in has no amount yet").toBeNull();

    // --- 1. Baseline -------------------------------------------------------
    const baseline = await aggregates();
    expect(baseline.booked.charged, "booked total is the two stays").toBe(
      roundCents(STAY_TOTAL + SECOND_STAY_TOTAL),
    );
    expect(baseline.booked.count, "three bookings in the period").toBe(3);
    expect(baseline.invoiced.charged, "nothing invoiced yet").toBe(0);
    expect(baseline.invoicedCount).toBe(0);
    expect(
      roundCents(baseline.booked.room + baseline.booked.breakfast),
      "split reconciles with the booked total",
    ).toBe(baseline.booked.charged);

    // --- Staff client ------------------------------------------------------
    const staffEmail = `ci+agg-staff-${stamp}@mimmobook.test`;
    const staffPassword = `Ci-Tmp-${randomUUID()}-Z9!`;
    const { data: staffUser, error: userErr } =
      await admin.auth.admin.createUser({
        email: staffEmail,
        password: staffPassword,
        email_confirm: true,
      });
    expect(userErr, userErr?.message).toBeNull();
    const { error: memberErr } = await admin.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: staffUser!.user!.id,
      role: "owner",
      is_approved: true,
    });
    expect(memberErr, memberErr?.message).toBeNull();
    const staffClient: SupabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: `ci-agg-${stamp}`,
        },
      },
    );
    const { error: signInErr } = await staffClient.auth.signInWithPassword({
      email: staffEmail,
      password: staffPassword,
    });
    expect(signInErr, signInErr?.message).toBeNull();

    /** Assert the whole aggregate snapshot is identical to `expected`. */
    const expectAggregates = async (
      label: string,
      expected: Awaited<ReturnType<typeof aggregates>>,
    ) => {
      const now = await aggregates();
      expect(now, `${label}: every period figure unchanged`).toEqual(expected);
      expect(
        roundCents(now.invoiced.room + now.invoiced.breakfast),
        `${label}: invoiced split reconciles`,
      ).toBe(now.invoiced.charged);
      return now;
    };

    try {
      // --- 2. Refused attempts move nothing --------------------------------
      const refuse = async (
        label: string,
        id: string,
        patch: Record<string, unknown>,
        expectedMessage: string,
      ) => {
        const before = await aggregates();
        const { error } = await staffClient
          .from("reservations")
          .update(patch)
          .eq("id", id)
          .eq("tenant_id", tenantId);
        expect(error, `${label}: must be refused`).not.toBeNull();
        expect(error!.message, `${label}: clear reason`).toContain(
          expectedMessage,
        );
        await expectAggregates(label, before);
      };

      // No amount at all.
      await refuse(
        "no-amount",
        dinner.id,
        { is_invoiced: true },
        NO_PRICE_ERROR,
      );
      // Fractions of a cent.
      await refuse(
        "sub-cent",
        dinner.id,
        { is_invoiced: true, price_eur: DINNER_TOTAL + 0.004 },
        AMOUNT_ERROR,
      );
      // An amount that does not cover the breakfast lines of the stay.
      await refuse(
        "below-breakfast",
        stay.id,
        { is_invoiced: true, price_eur: 40 },
        AMOUNT_ERROR,
      );
      // A tampered amount on the second stay.
      await refuse(
        "tampered-second-stay",
        stay2.id,
        { is_invoiced: true, price_eur: 12.3456 },
        AMOUNT_ERROR,
      );

      // Nothing invoiced, nothing changed since the baseline.
      await expectAggregates("after all refusals", baseline);
      expect(
        (await rowFor(stayEmail)).is_invoiced,
        "stay still uninvoiced",
      ).toBe(false);
      expect(
        (await rowFor(dinnerEmail)).price_eur,
        "no partial amount stored",
      ).toBeNull();

      // --- 3. A successful invoicing moves the invoiced figure only --------
      const { error: okErr } = await staffClient
        .from("reservations")
        .update({ is_invoiced: true })
        .eq("id", stay.id)
        .eq("tenant_id", tenantId);
      expect(okErr, okErr?.message).toBeNull();

      const afterFirst = await aggregates();
      expect(
        afterFirst.booked,
        "booked figures untouched by invoicing",
      ).toEqual(baseline.booked);
      expect(
        afterFirst.invoiced.charged,
        "invoiced total is exactly that stay",
      ).toBe(STAY_TOTAL);
      expect(afterFirst.invoicedCount).toBe(1);
      expect(
        roundCents(afterFirst.invoiced.room + afterFirst.invoiced.breakfast),
        "invoiced split reconciles",
      ).toBe(STAY_TOTAL);

      // --- 4. Repeating it moves nothing again -----------------------------
      for (let i = 0; i < 3; i++) {
        const { error } = await staffClient
          .from("reservations")
          .update({ is_invoiced: true })
          .eq("id", stay.id)
          .eq("tenant_id", tenantId);
        expect(error, `repeat ${i + 1} must not fail`).toBeNull();
      }
      await expectAggregates("repeated invoicing", afterFirst);

      // A tampered repeat on the invoiced booking is still refused, and the
      // aggregates stay where the successful invoicing left them.
      await refuse(
        "tampered-repeat",
        stay.id,
        { is_invoiced: true, price_eur: 30 },
        AMOUNT_ERROR,
      );
      await expectAggregates("after tampered repeat", afterFirst);

      // --- Pricing the dinner adds to booked, not to invoiced --------------
      const { error: priceErr } = await staffClient
        .from("reservations")
        .update({ price_eur: DINNER_TOTAL })
        .eq("id", dinner.id)
        .eq("tenant_id", tenantId);
      expect(priceErr, priceErr?.message).toBeNull();

      const afterPricing = await aggregates();
      expect(
        afterPricing.booked.charged,
        "booked total includes the priced dinner",
      ).toBe(roundCents(STAY_TOTAL + SECOND_STAY_TOTAL + DINNER_TOTAL));
      expect(
        afterPricing.invoiced,
        "invoiced figures unaffected by pricing",
      ).toEqual(afterFirst.invoiced);

      // Invoicing it now moves the invoiced figure by exactly that amount.
      const { error: dinnerInvoiceErr } = await staffClient
        .from("reservations")
        .update({ is_invoiced: true })
        .eq("id", dinner.id)
        .eq("tenant_id", tenantId);
      expect(dinnerInvoiceErr, dinnerInvoiceErr?.message).toBeNull();

      const afterSecond = await aggregates();
      expect(afterSecond.booked, "booked figures unchanged").toEqual(
        afterPricing.booked,
      );
      expect(
        afterSecond.invoiced.charged,
        "invoiced total grew by the dinner amount",
      ).toBe(roundCents(STAY_TOTAL + DINNER_TOTAL));
      expect(afterSecond.invoicedCount).toBe(2);

      // --- 5. Un-invoicing moves the figure back by the same amount --------
      const { error: undoErr } = await staffClient
        .from("reservations")
        .update({ is_invoiced: false })
        .eq("id", dinner.id)
        .eq("tenant_id", tenantId);
      expect(undoErr, undoErr?.message).toBeNull();

      const afterUndo = await aggregates();
      expect(afterUndo.booked, "booked figures still unchanged").toEqual(
        afterPricing.booked,
      );
      expect(
        afterUndo.invoiced.charged,
        "back to the single invoiced stay",
      ).toBe(STAY_TOTAL);
      expect(afterUndo.invoicedCount).toBe(1);
      expect(afterUndo.invoiced, "identical to the earlier snapshot").toEqual(
        afterFirst.invoiced,
      );
    } finally {
      await admin.auth.admin.deleteUser(staffUser!.user!.id);
    }
  });
});
