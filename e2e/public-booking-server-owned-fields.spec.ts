import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { reportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: the server owns the invoicing flag, the pricing notes and every
 * other staff/system field. Whatever a client sends for them is discarded and
 * only server-derived values are stored.
 *
 * Three bookings are sent with a fully loaded payload (invoiced, used, checked
 * in, confirmed, invented pricing notes, staff and internal notes, a
 * self-granted discount reason, a foreign creator id, made-up timestamps):
 *
 *   A) an accommodation stay against a priced room
 *   B) a dine-in booking with a menu pricing type
 *   C) a dine-in booking claiming a fixed price the resource does not offer
 *
 * For each one the stored row is checked field by field: pending, not
 * invoiced, not used, not checked in, no pricing notes, no staff or internal
 * notes, no creator, and the discount reason either absent or exactly the
 * server's own "Promo code: X" wording. Prices come from the resource, and the
 * report room + breakfast lines still add up to the charged amount.
 *
 * Finally a guest-level client is proven unable to write any of these fields,
 * either at insert time or by updating a stored booking.
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so CI
 * never blocks on missing secrets.
 */

const NIGHTLY_EUR = 95;
const BREAKFAST_EUR = 12.5;
const NIGHTS = 2;
const GUESTS = 2;
const STAY_TOTAL = NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS; // 240
const SET_MENU_EUR = 46;

/** Server-owned fields a tampered client might append to a request. */
const TAMPERED = {
  is_invoiced: true,
  is_used: true,
  is_checked_in: true,
  status: "confirmed",
  pricing_details: "Agreed free of charge with the owner",
  pricing_notes: "No charge",
  staff_notes: "VIP, do not bill",
  internal_notes: "Comped by request",
  discount_reason: "Owner said it is free",
  discount_type: "percentage",
  discount_value: 95,
  price_eur: 1,
  original_price_eur: 1,
  created_by: "00000000-0000-0000-0000-000000000001",
  created_at: "2000-01-01T00:00:00.000Z",
  updated_at: "2000-01-01T00:00:00.000Z",
  acknowledgment_email_sent_at: "2000-01-01T00:00:00.000Z",
  confirmation_email_sent_at: "2000-01-01T00:00:00.000Z",
  cancellation_email_sent_at: "2000-01-01T00:00:00.000Z",
  reminder_email_sent_at: "2000-01-01T00:00:00.000Z",
  linked_group_id: "00000000-0000-0000-0000-000000000002",
  tenant_id_override: "00000000-0000-0000-0000-000000000003",
} as const;

const SELECT_COLS =
  "id, status, is_invoiced, is_used, is_checked_in, pricing_type, pricing_details, staff_notes, internal_notes, discount_type, discount_value, discount_reason, discount_code_id, price_eur, original_price_eur, breakfast_included, breakfast_price_per_person, created_by, created_at, acknowledgment_email_sent_at, confirmation_email_sent_at, cancellation_email_sent_at, reminder_email_sent_at, reservation_type, date, check_out_date, guests_count";

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Server-owned invoicing flag and pricing notes", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("client-sent invoiced flags and pricing notes are discarded", async ({
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

    // --- Resources: one priced room, one restaurant with a set menu ---------
    const { data: room, error: roomErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Owned Fields Room ${stamp}`,
        resource_type: "guesthouse",
        capacity: 20,
        price_per_night: NIGHTLY_EUR,
        breakfast_price_per_person: BREAKFAST_EUR,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(roomErr, roomErr?.message).toBeNull();

    const { data: restaurant, error: restErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Owned Fields Restaurant ${stamp}`,
        resource_type: "restaurant",
        capacity: 40,
        is_active: true,
        approval_status: "approved",
        offers_table_reservation: true,
        offers_set_menu: true,
        sub_services: [{ name: "Set menu", price_eur: SET_MENU_EUR }],
      })
      .select("id")
      .single();
    expect(restErr, restErr?.message).toBeNull();

    // A real promo code, so the server's own discount_reason wording can be
    // compared against the one the client tried to invent.
    const promoCode = `CIOWNED${stamp}`;
    const { error: codeErr } = await admin.from("discount_codes").insert({
      tenant_id: tenantId,
      code: promoCode,
      discount_type: "percentage",
      discount_value: 10,
      is_active: true,
    });
    expect(codeErr, codeErr?.message).toBeNull();

    // --- The three tampered bookings ---------------------------------------
    const emails = {
      stay: `ci+owned-stay-${stamp}@mimmobook.test`,
      menu: `ci+owned-menu-${stamp}@mimmobook.test`,
      fixed: `ci+owned-fixed-${stamp}@mimmobook.test`,
    };

    const stayRes = await post({
      ...TAMPERED,
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      resource_id: room!.id,
      date: isoDate(200),
      check_out_date: isoDate(200 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Owned Stay ${stamp}`,
      guest_email: emails.stay,
      guest_phone: "+358401234567",
      promo_code: promoCode,
      special_requests: "Created by the server-owned fields E2E spec.",
    });
    expect(stayRes.status(), await stayRes.text()).toBe(200);

    const menuRes = await post({
      ...TAMPERED,
      tenant_id: tenantId,
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      resource_id: restaurant!.id,
      pricing_type: "menu",
      date: isoDate(210),
      start_time: "18:00",
      guests_count: 4,
      guest_name: `TEST CI Owned Menu ${stamp}`,
      guest_email: emails.menu,
      guest_phone: "+358401234567",
      special_requests: "Created by the server-owned fields E2E spec.",
    });
    expect(menuRes.status(), await menuRes.text()).toBe(200);

    const fixedRes = await post({
      ...TAMPERED,
      tenant_id: tenantId,
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      resource_id: restaurant!.id,
      pricing_type: "fixed_price",
      // Claims a price far above the only sub service the resource offers.
      fixed_price: 999,
      price_eur: 999,
      date: isoDate(220),
      start_time: "19:00",
      guests_count: 2,
      guest_name: `TEST CI Owned Fixed ${stamp}`,
      guest_email: emails.fixed,
      guest_phone: "+358401234567",
      special_requests: "Created by the server-owned fields E2E spec.",
    });
    expect(fixedRes.status(), await fixedRes.text()).toBe(200);

    const fetchRow = async (email: string) => {
      const { data, error } = await admin
        .from("reservations")
        .select(SELECT_COLS)
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      expect(error, error?.message).toBeNull();
      expect(data, `${email} stored the wrong number of bookings`).toHaveLength(1);
      return data![0] as Record<string, any>;
    };

    const stay = await fetchRow(emails.stay);
    const menu = await fetchRow(emails.menu);
    const fixed = await fetchRow(emails.fixed);

    // --- Every server-owned field ignores the client ------------------------
    for (const [label, row] of [
      ["stay", stay],
      ["menu", menu],
      ["fixed price", fixed],
    ] as const) {
      expect(row.status, `${label} status`).toBe("pending");
      expect(row.is_invoiced, `${label} is_invoiced`).toBe(false);
      expect(row.is_used, `${label} is_used`).toBe(false);
      expect(row.is_checked_in, `${label} is_checked_in`).toBe(false);
      expect(row.pricing_details, `${label} pricing notes`).toBeNull();
      expect(row.staff_notes, `${label} staff notes`).toBeNull();
      expect(row.internal_notes, `${label} internal notes`).toBeNull();
      expect(row.created_by, `${label} created_by`).toBeNull();
      expect(row.acknowledgment_email_sent_at, `${label} ack timestamp`).not.toBe(
        TAMPERED.acknowledgment_email_sent_at,
      );
      expect(row.confirmation_email_sent_at, `${label} confirmation timestamp`).toBeNull();
      expect(row.cancellation_email_sent_at, `${label} cancellation timestamp`).toBeNull();
      expect(row.reminder_email_sent_at, `${label} reminder timestamp`).toBeNull();
      // created_at is the real insert time, not the year 2000.
      expect(new Date(row.created_at).getUTCFullYear(), `${label} created_at`).toBeGreaterThan(
        2020,
      );
    }

    // --- Prices and discount wording come from the server ------------------
    // Stay: resource price with the real 10 % code, never the claimed 1 EUR or
    // the self-granted 95 %.
    expect(Number(stay.original_price_eur), "stay gross").toBe(STAY_TOTAL);
    expect(Number(stay.price_eur), "stay charged").toBe(roundCents(STAY_TOTAL * 0.9));
    expect(stay.discount_type, "stay discount type").toBe("percentage");
    expect(Number(stay.discount_value), "stay discount value").toBe(10);
    expect(stay.discount_reason, "stay discount wording").toBe(`Promo code: ${promoCode}`);
    expect(Number(stay.breakfast_price_per_person), "stay breakfast rate").toBe(BREAKFAST_EUR);

    // Menu-priced dine-in: no amount at all, no invented discount.
    expect(menu.pricing_type, "menu pricing type").toBe("menu");
    expect(menu.price_eur, "menu charged").toBeNull();
    expect(menu.discount_type, "menu discount type").toBeNull();
    expect(menu.discount_reason, "menu discount wording").toBeNull();

    // Fixed price dine-in: capped at what the resource actually offers.
    expect(fixed.pricing_type, "fixed pricing type").toBe("fixed_price");
    expect(Number(fixed.price_eur), "fixed charged").toBe(SET_MENU_EUR);
    expect(fixed.discount_reason, "fixed discount wording").toBeNull();

    // --- Reports still balance on the stored values ------------------------
    const stayAmounts = reportAmounts({
      reservation_type: stay.reservation_type,
      pricing_type: stay.pricing_type,
      date: stay.date,
      check_out_date: stay.check_out_date,
      guests_count: stay.guests_count,
      breakfast_included: stay.breakfast_included,
      breakfast_price_per_person: Number(stay.breakfast_price_per_person),
      price_eur: Number(stay.price_eur),
    });
    expect(roundCents(stayAmounts.room + stayAmounts.breakfast), "stay report split").toBe(
      Number(stay.price_eur),
    );

    // --- A guest-level client cannot write these fields -------------------
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: anonInsertErr } = await anon.from("reservations").insert({
      tenant_id: tenantId,
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      date: isoDate(230),
      start_time: "18:30",
      guests_count: 2,
      guest_name: `TEST CI Owned Anon ${stamp}`,
      guest_email: `ci+owned-anon-${stamp}@mimmobook.test`,
      guest_phone: "+358401234567",
      is_invoiced: true,
      pricing_details: "Free of charge",
      staff_notes: "Do not bill",
      price_eur: 0,
    });
    expect(anonInsertErr, "a guest must not insert invoicing or note fields").not.toBeNull();

    const { error: anonUpdateErr } = await anon
      .from("reservations")
      .update({ is_invoiced: true, pricing_details: "Free of charge", staff_notes: "Comped" })
      .eq("id", stay.id);
    // Either the API refuses it or RLS matches no row: the stored values must
    // be unchanged in both cases.
    const after = await fetchRow(emails.stay);
    expect(after.is_invoiced, "stay stayed uninvoiced").toBe(false);
    expect(after.pricing_details, "stay pricing notes stayed empty").toBeNull();
    expect(after.staff_notes, "stay staff notes stayed empty").toBeNull();
    expect(Number(after.price_eur), "stay amount unchanged").toBe(Number(stay.price_eur));
    if (anonUpdateErr) expect(anonUpdateErr.message.length).toBeGreaterThan(0);
  });
});
