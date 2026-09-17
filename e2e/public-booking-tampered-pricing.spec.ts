import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import {
  calcNights,
  calcBreakfastPrice,
  calcRoomPrice,
} from "@/lib/report-accommodation-pricing";

/**
 * End-to-end: a tampered guest browser cannot influence prices.
 *
 * A guest could edit the request the booking page sends (dev tools, curl,
 * a modified script) and try to book a 300 EUR stay for 1 EUR, mark it as
 * already invoiced, or grant themselves a 95% discount. The server must
 * ignore every money-related field in the request and recompute the price
 * from the tenant's own resource configuration, and the dashboard plus the
 * report figures must then show that canonical price.
 *
 * Locked here:
 *   accommodation  75 EUR/night x 3 nights + breakfast 12 x 2 guests x 3
 *                  = 297 EUR, no discount, status pending, not invoiced
 *   restaurant     "Set menu" 42 EUR from the resource, not the 1 EUR the
 *                  request claimed as fixed_price
 *   reports        room line + breakfast line = the charged amount
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so
 * CI never blocks on missing secrets.
 */

const NIGHTLY_EUR = 75;
const BREAKFAST_EUR = 12;
const NIGHTS = 3;
const GUESTS = 2;
const SET_MENU_EUR = 42;

const EXPECTED_ROOM = NIGHTLY_EUR * NIGHTS; // 225
const EXPECTED_BREAKFAST = BREAKFAST_EUR * GUESTS * NIGHTS; // 72
const EXPECTED_TOTAL = EXPECTED_ROOM + EXPECTED_BREAKFAST; // 297

/** What a tampered client might append to every booking request. */
const TAMPERED_MONEY_FIELDS = {
  price_eur: 1,
  original_price_eur: 1,
  final_price_eur: 1,
  total_price: 1,
  discount_type: "percentage",
  discount_value: 95,
  discount_reason: "Promo code: TAMPERED",
  breakfast_price_per_person: 0,
  stall_fee: 0,
  is_invoiced: true,
  status: "confirmed",
  staff_notes: "injected by client",
  internal_notes: "injected by client",
};

function projectRef(url: string): string {
  const m = url.match(/^https?:\/\/([^.]+)\./);
  if (!m) throw new Error(`Cannot derive project ref from ${url}`);
  return m[1];
}

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function seedSession(page: Page, session: unknown) {
  const storageKey = `sb-${projectRef(SUPABASE_URL)}-auth-token`;
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem("mimmobook-lang", "en");
      window.localStorage.setItem("mimmobook-tour-completed", "true");
    },
    { key: storageKey, value: session },
  );
}

test.describe("Tampered client pricing is recomputed server-side", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("ignores client-supplied prices and reports the resource-level amounts", async ({
    ephemeralTenant,
    page,
    request,
  }) => {
    const { admin, tenantId, ownerUserId, ownerEmail } = ephemeralTenant;
    const stamp = Date.now();
    const stayGuest = `TEST CI Tamper Stay ${stamp}`;
    const stayEmail = `ci+tamper-stay-${stamp}@mimmobook.test`;
    const dineGuest = `TEST CI Tamper Dine ${stamp}`;
    const dineEmail = `ci+tamper-dine-${stamp}@mimmobook.test`;
    const ownerPassword = `Ci-Owner-${randomUUID()}-Z9!`;
    const checkIn = isoDate(40);
    const checkOut = isoDate(40 + NIGHTS);

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

    // 1. Tenant-configured prices: the only legitimate source of money.
    const { data: stayResource, error: stayResErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Tamper Guesthouse ${stamp}`,
        resource_type: "guesthouse",
        capacity: 4,
        price_per_night: NIGHTLY_EUR,
        breakfast_price_per_person: BREAKFAST_EUR,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(stayResErr, stayResErr?.message).toBeNull();

    const { data: dineResource, error: dineResErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Tamper Restaurant ${stamp}`,
        resource_type: "restaurant",
        capacity: 40,
        is_active: true,
        approval_status: "approved",
        offers_set_menu: true,
        sub_services: [{ name: "Set menu", price_eur: SET_MENU_EUR }],
      })
      .select("id")
      .single();
    expect(dineResErr, dineResErr?.message).toBeNull();

    // 2. A stay booked with every money field tampered with in the request.
    const stayRes = await post({
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      resource_id: stayResource!.id,
      date: checkIn,
      check_out_date: checkOut,
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: stayGuest,
      guest_email: stayEmail,
      guest_phone: "+358401234567",
      special_requests: "Created by the tampered-pricing E2E spec.",
      ...TAMPERED_MONEY_FIELDS,
    });
    const stayBody = await stayRes.text();
    expect(stayRes.status(), `public-booking failed: ${stayBody}`).toBe(200);

    // 3. The stored row carries the recomputed price, not the injected one.
    const { data: stayRows, error: stayRowErr } = await admin
      .from("reservations")
      .select(
        "id, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, price_eur, original_price_eur, discount_type, discount_value, discount_reason, discount_code_id, is_invoiced, status, staff_notes, internal_notes",
      )
      .eq("tenant_id", tenantId)
      .eq("guest_email", stayEmail);
    expect(stayRowErr, stayRowErr?.message).toBeNull();
    expect(stayRows).toHaveLength(1);
    const stay = stayRows![0];

    expect(Number(stay.price_eur)).toBe(EXPECTED_TOTAL);
    expect(Number(stay.original_price_eur)).toBe(EXPECTED_TOTAL);
    // No discount can be self-granted without a valid promo code.
    expect(stay.discount_type).toBeNull();
    expect(stay.discount_value).toBeNull();
    expect(stay.discount_code_id).toBeNull();
    expect(stay.discount_reason).toBeNull();
    // Staff-only and system fields stay out of a guest's hands.
    expect(stay.is_invoiced).toBe(false);
    expect(stay.status).toBe("pending");
    expect(stay.staff_notes ?? null).toBeNull();
    expect(stay.internal_notes ?? null).toBeNull();

    // 4. A dine-in booking claiming a 1 EUR fixed price gets the resource price.
    const dineRes = await post({
      tenant_id: tenantId,
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      pricing_type: "fixed_price",
      fixed_price: 1,
      resource_id: dineResource!.id,
      date: isoDate(41),
      start_time: "18:00",
      guests_count: 4,
      guest_name: dineGuest,
      guest_email: dineEmail,
      guest_phone: "+358401234567",
      selected_sub_services: [{ id: "set-menu", name: "Set menu", price_eur: 1, qty: 1 }],
      ...TAMPERED_MONEY_FIELDS,
    });
    const dineBody = await dineRes.text();
    expect(dineRes.status(), `public-booking failed: ${dineBody}`).toBe(200);

    const { data: dineRows, error: dineRowErr } = await admin
      .from("reservations")
      .select("id, price_eur, original_price_eur, is_invoiced, status, pricing_type")
      .eq("tenant_id", tenantId)
      .eq("guest_email", dineEmail);
    expect(dineRowErr, dineRowErr?.message).toBeNull();
    expect(dineRows).toHaveLength(1);
    const dine = dineRows![0];
    expect(Number(dine.price_eur)).toBe(SET_MENU_EUR);
    expect(dine.is_invoiced).toBe(false);
    expect(dine.status).toBe("pending");

    // 5. Report figures derive from the stored canonical price: the room and
    //    breakfast lines must add up to exactly what the guest is charged.
    const reportRow = {
      reservation_type: stay.reservation_type,
      date: stay.date,
      check_out_date: stay.check_out_date,
      guests_count: stay.guests_count,
      breakfast_included: stay.breakfast_included,
      breakfast_price_per_person: stay.breakfast_price_per_person,
      price_eur: Number(stay.price_eur),
    };
    expect(calcNights(reportRow)).toBe(NIGHTS);
    expect(calcBreakfastPrice(reportRow)).toBeCloseTo(EXPECTED_BREAKFAST, 2);
    expect(calcRoomPrice(reportRow)).toBeCloseTo(EXPECTED_ROOM, 2);
    expect(calcRoomPrice(reportRow) + calcBreakfastPrice(reportRow)).toBeCloseTo(
      Number(stay.price_eur),
      2,
    );

    // 6. The dashboard shows the canonical amount, never the injected 1 EUR.
    const { error: pwErr } = await admin.auth.admin.updateUserById(ownerUserId, {
      password: ownerPassword,
    });
    expect(pwErr, pwErr?.message).toBeNull();

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    expect(signInErr, `owner sign-in failed: ${signInErr?.message}`).toBeNull();
    await seedSession(page, signIn.session);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("button", { name: "Reservations", exact: true }).first().click();

    const card = page
      .locator("div")
      .filter({ hasText: stayGuest })
      .filter({ hasText: `€${EXPECTED_TOTAL.toFixed(2)}` })
      .last();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText("€1.00")).toHaveCount(0);
    await expect(page.getByText("TAMPERED")).toHaveCount(0);
  });
});
