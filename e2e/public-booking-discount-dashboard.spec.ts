import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

/**
 * End-to-end: a guest books a public reservation with a promo code, and the
 * dashboard shows the canonical server-side price plus the invoice controls.
 *
 * Why this spec exists: pricing for public bookings is computed server-side
 * in the `public-booking` edge function (never trusted from the client), and
 * anonymous inserts are scrubbed by `validate_public_reservation_insert()`.
 * A regression there silently drops the price, so staff see a booking with
 * no money attached. This spec locks the whole chain:
 *
 *   guesthouse resource 60 EUR/night x 2 nights = 120 EUR gross
 *   promo code -25%                             =  90 EUR final
 *   dashboard row                               = "-25%" badge, EUR 90.00,
 *                                                 invoiced unchecked, then
 *                                                 checked and persisted
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so
 * CI never blocks on missing secrets.
 */

const NIGHTLY_EUR = 60;
const NIGHTS = 2;
const DISCOUNT_PERCENT = 25;
const GROSS_EUR = NIGHTLY_EUR * NIGHTS; // 120
const FINAL_EUR = GROSS_EUR * (1 - DISCOUNT_PERCENT / 100); // 90

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

/** Seed a real session plus deterministic UI prefs before the SPA mounts. */
async function seedSession(page: Page, session: unknown) {
  const storageKey = `sb-${projectRef(SUPABASE_URL)}-auth-token`;
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
      // English UI and no first-visit tour overlay, so selectors are stable.
      window.localStorage.setItem("mimmobook-lang", "en");
      window.localStorage.setItem("mimmobook-tour-completed", "true");
    },
    { key: storageKey, value: session },
  );
}

test.describe("Public booking with a discount code", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("stores the discounted price and shows it with invoice fields in the dashboard", async ({
    ephemeralTenant,
    page,
    request,
  }) => {
    const { admin, tenantId, ownerUserId, ownerEmail } = ephemeralTenant;
    const stamp = Date.now();
    const guestName = `TEST CI Discount Guest ${stamp}`;
    const guestEmail = `ci+guest-${stamp}@mimmobook.test`;
    const promoCode = `CIE2E${stamp}`.slice(0, 20).toUpperCase();
    const ownerPassword = `Ci-Owner-${randomUUID()}-Z9!`;
    const checkIn = isoDate(30);
    const checkOut = isoDate(30 + NIGHTS);

    // 1. A priced guesthouse resource: the only source of truth for money.
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Guesthouse ${stamp}`,
        resource_type: "guesthouse",
        capacity: 4,
        price_per_night: NIGHTLY_EUR,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();
    const resourceId = resource!.id as string;

    // 2. An active percentage promo code limited to guesthouse bookings.
    const { data: code, error: codeErr } = await admin
      .from("discount_codes")
      .insert({
        tenant_id: tenantId,
        code: promoCode,
        description: "E2E discount spec",
        discount_type: "percentage",
        discount_value: DISCOUNT_PERCENT,
        applies_to: ["guesthouse"],
        is_active: true,
      })
      .select("id, used_count")
      .single();
    expect(codeErr, codeErr?.message).toBeNull();
    const codeId = code!.id as string;
    expect(code!.used_count).toBe(0);

    // 3. Book through the real public edge function, as a guest would.
    const res = await request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      data: {
        tenant_id: tenantId,
        reservation_type: "guesthouse",
        resource_id: resourceId,
        date: checkIn,
        check_out_date: checkOut,
        guests_count: 2,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: "+358401234567",
        promo_code: promoCode.toLowerCase(), // case-insensitive claim
        special_requests: "Created by the E2E discount spec.",
      },
      timeout: 30_000,
    });
    const bodyText = await res.text();
    expect(res.status(), `public-booking failed: ${bodyText}`).toBe(200);

    // 4. The stored row must carry canonical pricing and discount metadata.
    const { data: rows, error: rowErr } = await admin
      .from("reservations")
      .select(
        "id, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason, is_invoiced, status",
      )
      .eq("tenant_id", tenantId)
      .eq("guest_email", guestEmail);
    expect(rowErr, rowErr?.message).toBeNull();
    expect(rows).toHaveLength(1);
    const row = rows![0];

    expect(Number(row.original_price_eur)).toBe(GROSS_EUR);
    expect(Number(row.price_eur)).toBe(FINAL_EUR);
    expect(row.discount_type).toBe("percentage");
    expect(Number(row.discount_value)).toBe(DISCOUNT_PERCENT);
    expect(row.discount_code_id).toBe(codeId);
    expect(row.discount_reason?.toUpperCase()).toContain(promoCode);
    expect(row.is_invoiced).toBe(false);
    expect(row.status).toBe("pending");

    // The claim is atomic, so the code's usage counter moved exactly once.
    const { data: claimed } = await admin
      .from("discount_codes")
      .select("used_count")
      .eq("id", codeId)
      .single();
    expect(claimed!.used_count).toBe(1);

    // 5. Sign the owner in and inspect the booking in the dashboard.
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

    // The row for this guest: price, discount badge and invoice controls.
    const card = page
      .locator("div")
      .filter({ hasText: guestName })
      .filter({ hasText: `€${FINAL_EUR.toFixed(2)}` })
      .last();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText(`€${FINAL_EUR.toFixed(2)}`).first()).toBeVisible();
    // Discount badge uses a minus sign (U+2212) before the percentage.
    await expect(card.getByText(`\u2212${DISCOUNT_PERCENT}%`).first()).toBeVisible();
    await expect(card.getByText(new RegExp(promoCode, "i")).first()).toBeVisible();

    const invoicedToggle = card
      .locator("label")
      .filter({ hasText: "Invoiced" })
      .first();
    const invoicedBox = invoicedToggle.getByRole("checkbox");
    await expect(invoicedBox).toHaveAttribute("data-state", "unchecked");

    // 6. Marking it invoiced from the dashboard persists to the booking.
    await invoicedBox.click();
    await expect(invoicedBox).toHaveAttribute("data-state", "checked", { timeout: 15_000 });
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("reservations")
            .select("is_invoiced, price_eur")
            .eq("id", row.id)
            .single();
          return data?.is_invoiced === true && Number(data?.price_eur) === FINAL_EUR;
        },
        { timeout: 15_000, intervals: [500, 1000, 2000] },
      )
      .toBe(true);
  });
});
