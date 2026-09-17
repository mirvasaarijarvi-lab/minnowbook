import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { reportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: after a staff member edits pricing-relevant fields, the report
 * lines follow the stored booking, and the booking cannot be invoiced until the
 * amount reconciles with those recalculated lines again.
 *
 * A two-night stay for two guests is booked through the public function
 * (server-calculated amount, server breakfast rate). Then, as a signed-in staff
 * member, we:
 *   - add guests, extend the stay and raise the breakfast rate, each time
 *     checking the recalculated room + breakfast lines against the stored
 *     amount, and that invoicing is refused while they no longer reconcile
 *   - update the amount to the recalculated total and invoice it
 *   - prove an already invoiced booking cannot be edited back into an
 *     inconsistent state, while unrelated edits (notes, status) stay allowed
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

const AMOUNT_ERROR = "Invoice amount must match the recalculated room and breakfast totals.";

const NIGHTLY = 105;
const BREAKFAST_RATE = 14;
const NIGHTS = 2;
const GUESTS = 2;
const BOOKED_TOTAL = NIGHTLY * NIGHTS + BREAKFAST_RATE * GUESTS * NIGHTS; // 210 + 56

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Staff pricing edits and invoicing", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("blocks invoicing until the edited totals reconcile again", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Staff Edit Room ${stamp}`,
        resource_type: "guesthouse",
        capacity: 8,
        price_per_night: NIGHTLY,
        breakfast_price_per_person: BREAKFAST_RATE,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();

    const guestEmail = `ci+staff-edit-${stamp}@mimmobook.test`;
    const checkIn = isoDate(340);
    const res = await request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
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
        check_out_date: isoDate(340 + NIGHTS),
        guests_count: GUESTS,
        breakfast_included: true,
        guest_name: `TEST CI Staff Pricing Edit ${stamp}`,
        guest_email: guestEmail,
        guest_phone: "+358401234567",
        special_requests: "Created by the staff pricing edit E2E spec.",
      },
      timeout: 30_000,
    });
    expect(res.status(), await res.text()).toBe(200);

    const cols =
      "id, is_invoiced, price_eur, original_price_eur, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, pricing_type, staff_notes, status";
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

    const booked = await fetchRow();
    expect(Number(booked.price_eur), "server-calculated amount").toBe(BOOKED_TOTAL);
    expect(Number(booked.breakfast_price_per_person), "server breakfast rate").toBe(
      BREAKFAST_RATE,
    );
    const bookedSplit = reportAmounts(booked as any);
    expect(roundCents(bookedSplit.room + bookedSplit.breakfast)).toBe(BOOKED_TOTAL);

    // --- Signed-in staff member -------------------------------------------
    const staffEmail = `ci+staff-edit-user-${stamp}@mimmobook.test`;
    const staffPassword = `Ci-Tmp-${randomUUID()}-Z9!`;
    const { data: staffUser, error: userErr } = await admin.auth.admin.createUser({
      email: staffEmail,
      password: staffPassword,
      email_confirm: true,
    });
    expect(userErr, userErr?.message).toBeNull();
    const { error: memberErr } = await admin.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: staffUser!.user!.id,
      role: "staff",
      is_approved: true,
    });
    expect(memberErr, memberErr?.message).toBeNull();

    const staff = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await staff.auth.signInWithPassword({
      email: staffEmail,
      password: staffPassword,
    });
    expect(signInErr, signInErr?.message).toBeNull();

    // --- Edit 1: more guests, longer stay, higher breakfast rate ----------
    const newNights = 4;
    const newGuests = 6;
    const newRate = 19.5;
    const { error: editErr } = await staff
      .from("reservations")
      .update({
        guests_count: newGuests,
        check_out_date: isoDate(340 + newNights),
        breakfast_price_per_person: newRate,
      })
      .eq("id", booked.id)
      .eq("tenant_id", tenantId);
    expect(editErr, editErr?.message).toBeNull();

    const edited = await fetchRow();
    const expectedBreakfast = newRate * newGuests * newNights; // 468
    const editedSplit = reportAmounts(edited as any);

    // The stored fields drive the recalculated lines: the breakfast the guests
    // now consume (468 EUR) exceeds the amount still stored on the booking, so
    // the report has to clamp breakfast to the charged amount and show no room
    // line at all. That is the signal the totals no longer reconcile.
    expect(Number(edited.guests_count)).toBe(newGuests);
    expect(Number(edited.breakfast_price_per_person)).toBe(newRate);
    expect(Number(edited.price_eur), "the stored amount has not been raised").toBe(BOOKED_TOTAL);
    expect(
      expectedBreakfast > BOOKED_TOTAL,
      "the edit leaves the amount below the recalculated breakfast",
    ).toBe(true);
    expect(roundCents(editedSplit.breakfast), "breakfast clamped to the amount").toBe(
      BOOKED_TOTAL,
    );
    expect(roundCents(editedSplit.room), "no room line left").toBe(0);

    // Invoicing is refused while the amount no longer reconciles.
    const { error: blockedErr } = await staff
      .from("reservations")
      .update({ is_invoiced: true })
      .eq("id", booked.id)
      .eq("tenant_id", tenantId);
    expect(blockedErr, "invoicing must be refused after the edit").not.toBeNull();
    expect(blockedErr!.message).toContain(AMOUNT_ERROR);
    expect((await fetchRow()).is_invoiced, "still uninvoiced").toBe(false);

    // A partial correction that still does not reconcile is refused too.
    const { error: partialErr } = await staff
      .from("reservations")
      .update({ is_invoiced: true, price_eur: 400 })
      .eq("id", booked.id)
      .eq("tenant_id", tenantId);
    expect(partialErr, "a partial correction must be refused").not.toBeNull();
    expect(partialErr!.message).toContain(AMOUNT_ERROR);

    // --- Edit 2: the recalculated total is accepted -----------------------
    const recalculated = NIGHTLY * newNights + expectedBreakfast; // 420 + 468
    const { error: okErr } = await staff
      .from("reservations")
      .update({ is_invoiced: true, price_eur: recalculated })
      .eq("id", booked.id)
      .eq("tenant_id", tenantId);
    expect(okErr, okErr?.message).toBeNull();

    const invoicedRow = await fetchRow();
    expect(invoicedRow.is_invoiced, "invoiced once the totals match").toBe(true);
    const invoicedSplit = reportAmounts(invoicedRow as any);
    expect(roundCents(invoicedSplit.room + invoicedSplit.breakfast), "split reconciles").toBe(
      recalculated,
    );
    expect(roundCents(invoicedSplit.charged)).toBe(recalculated);

    // --- An invoiced booking cannot be edited into an inconsistent state --
    for (const patch of [
      { guests_count: 12 },
      { check_out_date: isoDate(340 + 12) },
      { breakfast_price_per_person: 60 },
      { price_eur: 100 },
      { price_eur: 900.005 },
    ]) {
      const { error } = await staff
        .from("reservations")
        .update(patch)
        .eq("id", booked.id)
        .eq("tenant_id", tenantId);
      expect(error, `editing an invoiced booking with ${JSON.stringify(patch)}`).not.toBeNull();
      expect(error!.message).toContain(AMOUNT_ERROR);
    }

    const untouched = await fetchRow();
    expect(Number(untouched.price_eur), "invoiced amount untouched").toBe(recalculated);
    expect(Number(untouched.guests_count)).toBe(newGuests);
    expect(Number(untouched.breakfast_price_per_person)).toBe(newRate);

    // Unrelated edits on an invoiced booking are still allowed, and a pricing
    // edit that keeps the totals reconciled is accepted.
    const { error: noteErr } = await staff
      .from("reservations")
      .update({ staff_notes: "Checked by the staff pricing edit spec.", status: "confirmed" })
      .eq("id", booked.id)
      .eq("tenant_id", tenantId);
    expect(noteErr, noteErr?.message).toBeNull();

    const { error: raiseErr } = await staff
      .from("reservations")
      .update({ price_eur: recalculated + 50 })
      .eq("id", booked.id)
      .eq("tenant_id", tenantId);
    expect(raiseErr, "a consistent amount change is allowed").toBeNull();

    const final = await fetchRow();
    const finalSplit = reportAmounts(final as any);
    expect(roundCents(finalSplit.room + finalSplit.breakfast), "final split reconciles").toBe(
      recalculated + 50,
    );
    expect(final.staff_notes).toContain("Checked by the staff pricing edit spec.");
    expect(final.is_invoiced).toBe(true);

    await admin.auth.admin.deleteUser(staffUser!.user!.id);
  });
});
