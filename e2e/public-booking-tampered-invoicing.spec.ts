import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import {
  calcBreakfastPrice,
  calcRoomPrice,
  roundCents,
} from "@/lib/report-accommodation-pricing";

/**
 * End-to-end: a booking whose money fields were tampered with cannot be
 * invoiced until the server-side recalculated total is consistent.
 *
 * Two bookings are sent with `is_invoiced: true`, a self-granted discount and
 * an invented amount:
 *
 *   A) a stay against a priced resource -> server recalculates 240 EUR,
 *      stores it as pending and NOT invoiced; staff can then invoice it, and
 *      the stored amount stays the canonical one (room + breakfast lines add
 *      up to it exactly).
 *   B) a dine-in booking claiming a 500 EUR fixed price against a resource
 *      with NO configured price -> the server refuses to echo the claim, so
 *      the booking is stored with no amount and staff invoicing is blocked
 *      ("Add a price before marking this reservation as invoiced."). Once a
 *      consistent price is set, the same toggle succeeds.
 *
 * A guest is also proven unable to flip `is_invoiced` directly through the
 * API, before or after the amount exists.
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so
 * CI never blocks on missing secrets.
 */

const NIGHTLY_EUR = 90;
const BREAKFAST_EUR = 15;
const NIGHTS = 2;
const GUESTS = 2;
const STAY_TOTAL = NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS; // 240
const STAFF_SET_PRICE = 120;

/** Money and status fields a tampered client might append to a request. */
const TAMPERED = {
  price_eur: 500,
  original_price_eur: 500,
  final_price_eur: 500,
  total_price: 500,
  discount_type: "percentage",
  discount_value: 99,
  discount_reason: "Promo code: FREEBIE",
  is_invoiced: true,
  status: "confirmed",
} as const;

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

test.describe("Tampered bookings cannot be invoiced until totals are consistent", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(
    !SUPABASE_ANON_KEY,
    "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.",
  );

  test("blocks invoicing until the recalculated total is present and consistent", async ({
    ephemeralTenant,
    page,
    request,
  }) => {
    const { admin, tenantId, ownerUserId, ownerEmail } = ephemeralTenant;
    const stamp = Date.now();
    const stayGuest = `TEST CI Invoice Stay ${stamp}`;
    const stayEmail = `ci+invoice-stay-${stamp}@mimmobook.test`;
    const dineGuest = `TEST CI Invoice Dine ${stamp}`;
    const dineEmail = `ci+invoice-dine-${stamp}@mimmobook.test`;
    const ownerPassword = `Ci-Owner-${randomUUID()}-Z9!`;

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

    // 1. One priced resource, one resource with no price configured at all.
    const { data: stayResource, error: stayResErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Invoice Guesthouse ${stamp}`,
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
        name: `TEST CI Invoice Restaurant ${stamp}`,
        resource_type: "restaurant",
        capacity: 30,
        is_active: true,
        approval_status: "approved",
        offers_table_reservation: true,
        // Deliberately unpriced: nothing the server could charge.
        sub_services: [{ name: "Chef's choice" }],
      })
      .select("id")
      .single();
    expect(dineResErr, dineResErr?.message).toBeNull();

    // 2. Stay booked with every money field tampered with, including invoiced.
    const stayRes = await post({
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      resource_id: stayResource!.id,
      date: isoDate(60),
      check_out_date: isoDate(60 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: stayGuest,
      guest_email: stayEmail,
      guest_phone: "+358401234567",
      special_requests: "Created by the tampered-invoicing E2E spec.",
      ...TAMPERED,
    });
    expect(stayRes.status(), await stayRes.text()).toBe(200);

    // 3. Dine-in booking claiming a 500 EUR fixed price with nothing configured.
    const dineRes = await post({
      tenant_id: tenantId,
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      pricing_type: "fixed_price",
      fixed_price: 500,
      resource_id: dineResource!.id,
      date: isoDate(61),
      start_time: "19:00",
      guests_count: 4,
      guest_name: dineGuest,
      guest_email: dineEmail,
      guest_phone: "+358401234567",
      special_requests: "Created by the tampered-invoicing E2E spec.",
      ...TAMPERED,
    });
    expect(dineRes.status(), await dineRes.text()).toBe(200);

    const readRow = async (email: string) => {
      const { data, error } = await admin
        .from("reservations")
        .select(
          "id, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, price_eur, original_price_eur, discount_type, discount_value, is_invoiced, status",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      expect(error, error?.message).toBeNull();
      expect(data).toHaveLength(1);
      return data![0];
    };

    const stayRow = await readRow(stayEmail);
    const dineRow = await readRow(dineEmail);

    // 4. Neither booking arrives invoiced, whatever the request claimed.
    expect(stayRow.is_invoiced).toBe(false);
    expect(stayRow.status).toBe("pending");
    expect(Number(stayRow.price_eur)).toBe(STAY_TOTAL);
    expect(Number(stayRow.original_price_eur)).toBe(STAY_TOTAL);
    expect(stayRow.discount_type).toBeNull();
    expect(stayRow.discount_value).toBeNull();

    expect(dineRow.is_invoiced).toBe(false);
    expect(dineRow.status).toBe("pending");
    // The 500 EUR claim is dropped, not echoed: no amount to invoice yet.
    expect(dineRow.price_eur).toBeNull();

    // 5. A guest cannot flip the invoiced flag through the API either.
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const row of [stayRow, dineRow]) {
      const { data: anonUpdate } = await anon
        .from("reservations")
        .update({ is_invoiced: true, price_eur: 500 })
        .eq("id", row.id)
        .select("id");
      expect(anonUpdate ?? []).toHaveLength(0);
      const { data: after } = await admin
        .from("reservations")
        .select("is_invoiced, price_eur")
        .eq("id", row.id)
        .single();
      expect(after!.is_invoiced).toBe(false);
      expect(after!.price_eur == null ? null : Number(after!.price_eur)).toBe(
        row.price_eur == null ? null : Number(row.price_eur),
      );
    }

    // 6. Staff view: sign the owner in.
    const { error: pwErr } = await admin.auth.admin.updateUserById(
      ownerUserId,
      {
        password: ownerPassword,
      },
    );
    expect(pwErr, pwErr?.message).toBeNull();
    const { data: signIn, error: signInErr } =
      await anon.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      });
    expect(signInErr, `owner sign-in failed: ${signInErr?.message}`).toBeNull();
    await seedSession(page, signIn.session);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await page
      .getByRole("button", { name: "Reservations", exact: true })
      .first()
      .click();

    const invoicedBox = (guest: string, amount?: string) => {
      let card = page.locator("div").filter({ hasText: guest });
      card = amount
        ? card.filter({ hasText: amount })
        : card.filter({ has: page.locator("label", { hasText: "Invoiced" }) });
      return card
        .last()
        .locator("label")
        .filter({ hasText: "Invoiced" })
        .first()
        .getByRole("checkbox");
    };

    // 6a. The unpriced dine-in booking cannot be invoiced.
    const dineBox = invoicedBox(dineGuest);
    await expect(dineBox).toHaveAttribute("data-state", "unchecked", {
      timeout: 20_000,
    });
    await dineBox.click();
    await expect(
      page.getByText(
        "Add a price before marking this reservation as invoiced.",
      ),
    ).toBeVisible({ timeout: 10_000 });
    await expect(dineBox).toHaveAttribute("data-state", "unchecked");
    const { data: dineBlocked } = await admin
      .from("reservations")
      .select("is_invoiced, price_eur")
      .eq("id", dineRow.id)
      .single();
    expect(dineBlocked!.is_invoiced).toBe(false);
    expect(dineBlocked!.price_eur).toBeNull();

    // 6b. The recalculated stay carries a consistent total and can be invoiced.
    const stayBox = invoicedBox(stayGuest, `€${STAY_TOTAL.toFixed(2)}`);
    await expect(stayBox).toHaveAttribute("data-state", "unchecked", {
      timeout: 20_000,
    });
    await stayBox.click();
    await expect(stayBox).toHaveAttribute("data-state", "checked", {
      timeout: 15_000,
    });
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("reservations")
            .select("is_invoiced, price_eur")
            .eq("id", stayRow.id)
            .single();
          return (
            data?.is_invoiced === true &&
            Math.abs(Number(data?.price_eur) - STAY_TOTAL) < 0.005
          );
        },
        { timeout: 15_000, intervals: [500, 1000, 2000] },
      )
      .toBe(true);

    // The invoiced amount is the one reports split, to the cent.
    const finalStay = await readRow(stayEmail);
    const reportRow = {
      reservation_type: finalStay.reservation_type,
      date: finalStay.date,
      check_out_date: finalStay.check_out_date,
      guests_count: finalStay.guests_count,
      breakfast_included: finalStay.breakfast_included,
      breakfast_price_per_person: Number(finalStay.breakfast_price_per_person),
      price_eur: Number(finalStay.price_eur),
    };
    expect(
      roundCents(calcRoomPrice(reportRow) + calcBreakfastPrice(reportRow)),
    ).toBe(roundCents(Number(finalStay.price_eur)));

    // 6c. Once staff set a real price, the previously blocked booking invoices.
    const { error: priceErr } = await admin
      .from("reservations")
      .update({ price_eur: STAFF_SET_PRICE })
      .eq("id", dineRow.id);
    expect(priceErr, priceErr?.message).toBeNull();

    await page.reload();
    await page
      .getByRole("button", { name: "Reservations", exact: true })
      .first()
      .click();
    const dineBoxAgain = invoicedBox(
      dineGuest,
      `€${STAFF_SET_PRICE.toFixed(2)}`,
    );
    await expect(dineBoxAgain).toHaveAttribute("data-state", "unchecked", {
      timeout: 20_000,
    });
    await dineBoxAgain.click();
    await expect(dineBoxAgain).toHaveAttribute("data-state", "checked", {
      timeout: 15_000,
    });
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("reservations")
            .select("is_invoiced, price_eur")
            .eq("id", dineRow.id)
            .single();
          return (
            data?.is_invoiced === true &&
            Math.abs(Number(data?.price_eur) - STAFF_SET_PRICE) < 0.005
          );
        },
        { timeout: 15_000, intervals: [500, 1000, 2000] },
      )
      .toBe(true);
  });
});
