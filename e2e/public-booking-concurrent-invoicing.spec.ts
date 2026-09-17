import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { reportAmounts, sumReportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: concurrent invoicing requests for the same booking.
 *
 *  1. Ten staff clients fire `is_invoiced = true` at the same moment for a
 *     correctly priced stay. The booking ends up invoiced exactly once: the
 *     history holds a single false -> true transition, the stored amount never
 *     moves, and the reported revenue is counted once.
 *  2. Ten concurrent requests against a booking whose totals are still
 *     inconsistent (no amount at all, and a mismatching amount) are all
 *     refused with a clear message, and nothing is recorded as invoiced.
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

const AMOUNT_ERROR = "Invoice amount must match the recalculated room and breakfast totals.";
const NO_PRICE_ERROR = "Add a price before marking this reservation as invoiced.";

const NIGHTLY = 110;
const BREAKFAST_RATE = 11;
const NIGHTS = 2;
const GUESTS = 3;
const EXPECTED_TOTAL = NIGHTLY * NIGHTS + BREAKFAST_RATE * GUESTS * NIGHTS; // 220 + 66
const CONCURRENCY = 10;

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Concurrent invoicing", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("invoices only once and refuses while totals are inconsistent", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    // --- Resources ---------------------------------------------------------
    const { data: resources, error: resErr } = await admin
      .from("resources")
      .insert([
        {
          tenant_id: tenantId,
          name: `TEST CI Concurrent Room ${stamp}`,
          resource_type: "guesthouse",
          capacity: 6,
          price_per_night: NIGHTLY,
          breakfast_price_per_person: BREAKFAST_RATE,
          is_active: true,
          approval_status: "approved",
        },
        {
          tenant_id: tenantId,
          name: `TEST CI Concurrent Unpriced Table ${stamp}`,
          resource_type: "restaurant",
          capacity: 30,
          is_active: true,
          approval_status: "approved",
          offers_table_reservation: true,
        },
      ])
      .select("id, resource_type");
    expect(resErr, resErr?.message).toBeNull();
    const roomId = resources!.find((r) => r.resource_type === "guesthouse")!.id;
    const tableId = resources!.find((r) => r.resource_type === "restaurant")!.id;

    // --- Bookings through the public function ------------------------------
    const book = async (data: Record<string, unknown>) => {
      const res = await request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        data: { tenant_id: tenantId, ...data },
        timeout: 30_000,
      });
      expect(res.status(), await res.text()).toBe(200);
    };

    const stayEmail = `ci+concurrent-stay-${stamp}@mimmobook.test`;
    const dinnerEmail = `ci+concurrent-dinner-${stamp}@mimmobook.test`;

    await book({
      reservation_type: "guesthouse",
      resource_id: roomId,
      date: isoDate(320),
      check_out_date: isoDate(320 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Concurrent Stay ${stamp}`,
      guest_email: stayEmail,
      guest_phone: "+358401234567",
      special_requests: "Created by the concurrent invoicing E2E spec.",
    });
    await book({
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      resource_id: tableId,
      date: isoDate(321),
      start_time: "19:00",
      guests_count: 2,
      guest_name: `TEST CI Concurrent Dinner ${stamp}`,
      guest_email: dinnerEmail,
      guest_phone: "+358401234567",
      special_requests: "Created by the concurrent invoicing E2E spec.",
    });

    const cols =
      "id, is_invoiced, price_eur, original_price_eur, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, pricing_type";
    const fetchRow = async (email: string) => {
      const { data, error } = await admin
        .from("reservations")
        .select(cols)
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      expect(error, error?.message).toBeNull();
      expect(data).toHaveLength(1);
      return data![0] as Record<string, any>;
    };

    const stay = await fetchRow(stayEmail);
    const dinner = await fetchRow(dinnerEmail);
    expect(Number(stay.price_eur), "server-recalculated stay total").toBe(EXPECTED_TOTAL);
    expect(stay.is_invoiced).toBe(false);
    expect(dinner.price_eur, "dine-in has no amount yet").toBeNull();

    // --- Ten signed-in staff clients ---------------------------------------
    const users: string[] = [];
    const clients: SupabaseClient[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      const email = `ci+concurrent-staff-${i}-${stamp}@mimmobook.test`;
      const password = `Ci-Tmp-${randomUUID()}-Z9!`;
      const { data: u, error: ue } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(ue, ue?.message).toBeNull();
      users.push(u!.user!.id);
      const { error: me } = await admin.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: u!.user!.id,
        role: i === 0 ? "owner" : "staff",
        is_approved: true,
      });
      expect(me, me?.message).toBeNull();
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: `ci-${i}-${stamp}` },
      });
      const { error: se } = await client.auth.signInWithPassword({ email, password });
      expect(se, se?.message).toBeNull();
      clients.push(client);
    }

    const invoiceTransitions = async (reservationId: string) => {
      const { data, error } = await admin
        .from("audit_log")
        .select("id, old_data, new_data")
        .eq("tenant_id", tenantId)
        .eq("table_name", "reservations")
        .eq("record_id", reservationId)
        .eq("action", "UPDATE");
      expect(error, error?.message).toBeNull();
      return (data ?? []).filter(
        (e: any) =>
          e.old_data?.is_invoiced === false && e.new_data?.is_invoiced === true,
      );
    };

    // --- 1. Concurrent invoicing of a correctly priced stay ----------------
    const stayResults = await Promise.all(
      clients.map((c) =>
        c
          .from("reservations")
          .update({ is_invoiced: true })
          .eq("id", stay.id)
          .eq("tenant_id", tenantId),
      ),
    );
    for (const r of stayResults) {
      // No request may fail: either it performs the transition or it finds the
      // booking already invoiced.
      expect(r.error, r.error?.message).toBeNull();
    }

    const stayAfter = await fetchRow(stayEmail);
    expect(stayAfter.is_invoiced, "invoiced once").toBe(true);
    expect(Number(stayAfter.price_eur), "amount never moved").toBe(EXPECTED_TOTAL);

    const stayTransitions = await invoiceTransitions(stay.id);
    expect(stayTransitions, "exactly one invoicing recorded").toHaveLength(1);

    const staySplit = reportAmounts(stayAfter as any);
    expect(roundCents(staySplit.room + staySplit.breakfast), "split reconciles").toBe(
      EXPECTED_TOTAL,
    );
    expect(
      sumReportAmounts([stayAfter as any]).charged,
      "revenue counted once, not per request",
    ).toBe(EXPECTED_TOTAL);

    // --- 2. Concurrent invoicing while totals are inconsistent -------------
    const dinnerResults = await Promise.all(
      clients.map((c) =>
        c
          .from("reservations")
          .update({ is_invoiced: true })
          .eq("id", dinner.id)
          .eq("tenant_id", tenantId),
      ),
    );
    for (const r of dinnerResults) {
      expect(r.error, "an unpriced booking may never be invoiced").not.toBeNull();
      expect(r.error!.message).toContain(NO_PRICE_ERROR);
    }
    expect((await fetchRow(dinnerEmail)).is_invoiced, "still uninvoiced").toBe(false);
    expect(await invoiceTransitions(dinner.id), "nothing recorded as invoiced").toHaveLength(0);

    // A mismatching amount, sent concurrently, is refused the same way.
    const mismatchResults = await Promise.all(
      clients.map((c, i) =>
        c
          .from("reservations")
          .update({ is_invoiced: true, price_eur: 40.005 + i / 1000 })
          .eq("id", dinner.id)
          .eq("tenant_id", tenantId),
      ),
    );
    for (const r of mismatchResults) {
      expect(r.error, "a mismatching amount may never be invoiced").not.toBeNull();
      expect(r.error!.message).toContain(AMOUNT_ERROR);
    }
    const dinnerAfter = await fetchRow(dinnerEmail);
    expect(dinnerAfter.is_invoiced).toBe(false);
    expect(dinnerAfter.price_eur, "no partial amount stored").toBeNull();
    expect(await invoiceTransitions(dinner.id)).toHaveLength(0);

    // Once staff enter a real amount, one concurrent burst invoices it once.
    const { error: priceErr } = await admin
      .from("reservations")
      .update({ price_eur: 84 })
      .eq("id", dinner.id);
    expect(priceErr, priceErr?.message).toBeNull();

    const finalResults = await Promise.all(
      clients.map((c) =>
        c
          .from("reservations")
          .update({ is_invoiced: true })
          .eq("id", dinner.id)
          .eq("tenant_id", tenantId),
      ),
    );
    for (const r of finalResults) expect(r.error, r.error?.message).toBeNull();
    expect((await fetchRow(dinnerEmail)).is_invoiced).toBe(true);
    expect(await invoiceTransitions(dinner.id), "invoiced exactly once").toHaveLength(1);

    // --- Only the two bookings exist, each invoiced once ------------------
    const { data: invoiced } = await admin
      .from("reservations")
      .select("id, price_eur")
      .eq("tenant_id", tenantId)
      .eq("is_invoiced", true);
    expect(invoiced, "one invoiced row per booking").toHaveLength(2);
    expect(
      roundCents(sumReportAmounts(await allRows(admin, tenantId)).charged),
      "period revenue equals the two amounts",
    ).toBe(EXPECTED_TOTAL + 84);

    for (const id of users) await admin.auth.admin.deleteUser(id);
  });
});

async function allRows(admin: SupabaseClient, tenantId: string) {
  const { data } = await admin
    .from("reservations")
    .select(
      "price_eur, original_price_eur, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, pricing_type",
    )
    .eq("tenant_id", tenantId);
  return (data ?? []) as any[];
}
