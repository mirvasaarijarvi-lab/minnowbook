import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { reportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: the server refuses any API request that tries to invoice an
 * amount which does not reconcile with the room + breakfast split the reports
 * derive from it.
 *
 * A three-night stay for four guests is booked through the public function, so
 * the amount and the breakfast rate are the server's own. Then, through the
 * API, we attempt to invoice:
 *   - a sub-cent amount (0.005 tails would round differently per view)
 *   - an amount smaller than the breakfast component alone (room line negative)
 *   - a zero and a negative amount
 * Each attempt is refused with a clear message and leaves the booking
 * uninvoiced with its original amount. The server-recalculated amount is then
 * accepted, and the stored row's room + breakfast lines add up to it exactly.
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

const AMOUNT_ERROR =
  "Invoice amount must match the recalculated room and breakfast totals.";
const NO_PRICE_ERROR =
  "Add a price before marking this reservation as invoiced.";

const NIGHTLY = 96;
const BREAKFAST_RATE = 12.5;
const NIGHTS = 3;
const GUESTS = 4;
const EXPECTED_TOTAL = NIGHTLY * NIGHTS + BREAKFAST_RATE * GUESTS * NIGHTS; // 288 + 150

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Invoice amounts must reconcile with the report split", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(
    !SUPABASE_ANON_KEY,
    "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.",
  );

  test("rejects invoice amounts that do not match room + breakfast", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Consistency Room ${stamp}`,
        resource_type: "guesthouse",
        capacity: 6,
        price_per_night: NIGHTLY,
        breakfast_price_per_person: BREAKFAST_RATE,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();

    const guestEmail = `ci+invoice-consistency-${stamp}@mimmobook.test`;
    const checkIn = isoDate(300);
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/public-booking`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        data: {
          tenant_id: tenantId,
          reservation_type: "guesthouse",
          resource_id: resource!.id,
          date: checkIn,
          check_out_date: isoDate(300 + NIGHTS),
          guests_count: GUESTS,
          breakfast_included: true,
          breakfast_price_per_person: 0.01, // tampered; must be ignored
          price_eur: 1, // tampered; must be ignored
          guest_name: `TEST CI Invoice Consistency ${stamp}`,
          guest_email: guestEmail,
          guest_phone: "+358401234567",
          special_requests:
            "Created by the invoice amount consistency E2E spec.",
        },
        timeout: 30_000,
      },
    );
    expect(res.status(), await res.text()).toBe(200);

    const cols =
      "id, is_invoiced, price_eur, original_price_eur, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person";
    const fetchRow = async () => {
      const { data, error } = await admin
        .from("reservations")
        .select(cols)
        .eq("tenant_id", tenantId)
        .eq("guest_email", guestEmail);
      expect(error, error?.message).toBeNull();
      expect(data).toHaveLength(1);
      return data![0] as Record<string, any>;
    };

    const stored = await fetchRow();
    expect(Number(stored.price_eur), "server-recalculated total").toBe(
      EXPECTED_TOTAL,
    );
    expect(
      Number(stored.breakfast_price_per_person),
      "server breakfast rate",
    ).toBe(BREAKFAST_RATE);
    expect(stored.is_invoiced).toBe(false);

    const split = reportAmounts(stored as any);
    expect(roundCents(split.room + split.breakfast), "split reconciles").toBe(
      EXPECTED_TOTAL,
    );
    expect(roundCents(split.breakfast), "breakfast component").toBe(
      BREAKFAST_RATE * GUESTS * NIGHTS,
    );

    // --- Signed-in owner client -------------------------------------------
    const ownerEmail = `ci+invoice-consistency-owner-${stamp}@mimmobook.test`;
    const ownerPassword = `Ci-Tmp-${randomUUID()}-Z9!`;
    const { data: ownerUser, error: ownerErr } =
      await admin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
      });
    expect(ownerErr, ownerErr?.message).toBeNull();
    const { error: memberErr } = await admin.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: ownerUser!.user!.id,
      role: "owner",
      is_approved: true,
    });
    expect(memberErr, memberErr?.message).toBeNull();

    const staff = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await staff.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    expect(signInErr, signInErr?.message).toBeNull();

    // --- Every mismatching amount is refused ------------------------------
    const rejected: { label: string; price: number; message: string }[] = [
      { label: "sub-cent tail", price: 438.005, message: AMOUNT_ERROR },
      {
        label: "sub-cent tail (long)",
        price: 437.999999,
        message: AMOUNT_ERROR,
      },
      {
        label: "below the breakfast component",
        price: 149.99,
        message: AMOUNT_ERROR,
      },
      {
        label: "one cent below breakfast",
        price: 149.99,
        message: AMOUNT_ERROR,
      },
      { label: "zero", price: 0, message: NO_PRICE_ERROR },
      { label: "negative", price: -438, message: NO_PRICE_ERROR },
    ];

    for (const attempt of rejected) {
      const { error } = await staff
        .from("reservations")
        .update({ is_invoiced: true, price_eur: attempt.price })
        .eq("id", stored.id)
        .eq("tenant_id", tenantId);
      expect(error, `${attempt.label} must be refused`).not.toBeNull();
      expect(error!.message, `${attempt.label} message`).toContain(
        attempt.message,
      );

      const after = await fetchRow();
      expect(after.is_invoiced, `${attempt.label}: still uninvoiced`).toBe(
        false,
      );
      expect(
        Number(after.price_eur),
        `${attempt.label}: amount untouched`,
      ).toBe(EXPECTED_TOTAL);
    }

    // A tampered breakfast rate that would break the split is refused too.
    const { error: rateErr } = await staff
      .from("reservations")
      .update({ is_invoiced: true, breakfast_price_per_person: 200 })
      .eq("id", stored.id)
      .eq("tenant_id", tenantId);
    expect(
      rateErr,
      "breakfast rate above the total must be refused",
    ).not.toBeNull();
    expect(rateErr!.message).toContain(AMOUNT_ERROR);
    expect((await fetchRow()).is_invoiced).toBe(false);

    // A guest-level client gets nowhere either.
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await anon
      .from("reservations")
      .update({ is_invoiced: true, price_eur: 1 })
      .eq("id", stored.id);
    const afterAnon = await fetchRow();
    expect(afterAnon.is_invoiced, "guest cannot invoice").toBe(false);
    expect(Number(afterAnon.price_eur), "guest cannot change the amount").toBe(
      EXPECTED_TOTAL,
    );

    // Nothing is invoiced so far.
    const { data: invoiced } = await admin
      .from("reservations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_invoiced", true);
    expect(
      invoiced,
      "no booking invoiced by a mismatching amount",
    ).toHaveLength(0);

    // --- The recalculated amount is accepted ------------------------------
    const { error: okErr } = await staff
      .from("reservations")
      .update({ is_invoiced: true, price_eur: EXPECTED_TOTAL })
      .eq("id", stored.id)
      .eq("tenant_id", tenantId);
    expect(okErr, okErr?.message).toBeNull();

    const final = await fetchRow();
    expect(final.is_invoiced, "invoiced with the matching amount").toBe(true);
    const finalSplit = reportAmounts(final as any);
    expect(
      roundCents(finalSplit.room + finalSplit.breakfast),
      "invoiced split reconciles",
    ).toBe(EXPECTED_TOTAL);
    expect(roundCents(finalSplit.charged)).toBe(EXPECTED_TOTAL);

    await admin.auth.admin.deleteUser(ownerUser!.user!.id);
  });
});
