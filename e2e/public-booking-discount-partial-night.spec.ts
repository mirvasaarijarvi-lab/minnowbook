import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

/**
 * End-to-end: discounted stays whose length is NOT a clean whole-night
 * multiple, and what the dashboard shows for them.
 *
 * Two partial-night shapes are covered in one tenant:
 *
 *   A) Same-day stay (check-out == check-in, 0 nights) with a promo code.
 *      Nightly pricing yields nothing, so the server must store NO price
 *      while still recording the discount metadata. The dashboard must show
 *      the booking without a euro amount, and refuse to mark it invoiced
 *      ("Add a price before marking this reservation as invoiced.").
 *
 *   B) 3 nights at 89.90 EUR with -33%: 269.70 gross, 180.70 final after
 *      cent rounding (269.70 * 0.67 = 180.699). This locks the rounding of
 *      partial-euro discounts end to end: server price, dashboard amount,
 *      discount badge, and invoice persistence.
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so
 * CI never blocks on missing secrets.
 */

const NIGHTLY_EUR = 89.9;
const NIGHTS = 3;
const DISCOUNT_PERCENT = 33;
const GROSS_EUR = 269.7; // 3 x 89.90
const FINAL_EUR = 180.7; // 269.70 * 0.67 = 180.699 -> 180.70

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
      window.localStorage.setItem("mimmobook-lang", "en");
      window.localStorage.setItem("mimmobook-tour-completed", "true");
    },
    { key: storageKey, value: session },
  );
}

test.describe("Discounted partial-night stays", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(
    !SUPABASE_ANON_KEY,
    "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.",
  );

  test("prices partial nights correctly and reflects them in the dashboard", async ({
    ephemeralTenant,
    page,
    request,
  }) => {
    const { admin, tenantId, ownerUserId, ownerEmail } = ephemeralTenant;
    const stamp = Date.now();
    const dayGuestName = `TEST CI DayUse Guest ${stamp}`;
    const dayGuestEmail = `ci+dayuse-${stamp}@mimmobook.test`;
    const stayGuestName = `TEST CI Partial Guest ${stamp}`;
    const stayGuestEmail = `ci+partial-${stamp}@mimmobook.test`;
    const promoCode = `CIPN${stamp}`.slice(0, 20).toUpperCase();
    const ownerPassword = `Ci-Owner-${randomUUID()}-Z9!`;

    // 1. One priced guesthouse resource: the only source of truth for money.
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Partial Guesthouse ${stamp}`,
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

    // 2. An active percentage promo code usable for both bookings.
    const { data: code, error: codeErr } = await admin
      .from("discount_codes")
      .insert({
        tenant_id: tenantId,
        code: promoCode,
        description: "E2E partial-night discount spec",
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

    const book = async (payload: Record<string, unknown>) => {
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
            resource_id: resourceId,
            guests_count: 2,
            guest_phone: "+358401234567",
            promo_code: promoCode.toLowerCase(), // case-insensitive claim
            ...payload,
          },
          timeout: 30_000,
        },
      );
      const bodyText = await res.text();
      expect(res.status(), `public-booking failed: ${bodyText}`).toBe(200);
    };

    const readRow = async (email: string) => {
      const { data, error } = await admin
        .from("reservations")
        .select(
          "id, date, check_out_date, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason, is_invoiced, status",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      expect(error, error?.message).toBeNull();
      expect(data).toHaveLength(1);
      return data![0];
    };

    // 3a. Same-day stay: 0 nights, so no price may be invented server-side.
    const dayDate = isoDate(24);
    await book({
      date: dayDate,
      check_out_date: dayDate,
      guest_name: dayGuestName,
      guest_email: dayGuestEmail,
      special_requests: "Day use, created by the E2E partial-night spec.",
    });
    const dayRow = await readRow(dayGuestEmail);
    expect(dayRow.check_out_date).toBe(dayDate);
    expect(dayRow.price_eur).toBeNull();
    expect(dayRow.original_price_eur).toBeNull();
    expect(dayRow.discount_type).toBe("percentage");
    expect(Number(dayRow.discount_value)).toBe(DISCOUNT_PERCENT);
    expect(dayRow.discount_code_id).toBe(codeId);
    expect(dayRow.is_invoiced).toBe(false);

    // 3b. Three nights at 89.90 with -33%: partial-euro rounding.
    const checkIn = isoDate(40);
    const checkOut = isoDate(40 + NIGHTS);
    await book({
      date: checkIn,
      check_out_date: checkOut,
      guest_name: stayGuestName,
      guest_email: stayGuestEmail,
      special_requests: "Created by the E2E partial-night spec.",
    });
    const stayRow = await readRow(stayGuestEmail);
    expect(Number(stayRow.original_price_eur)).toBeCloseTo(GROSS_EUR, 2);
    expect(Number(stayRow.price_eur)).toBeCloseTo(FINAL_EUR, 2);
    expect(stayRow.discount_code_id).toBe(codeId);
    expect(stayRow.discount_reason?.toUpperCase()).toContain(promoCode);
    expect(stayRow.is_invoiced).toBe(false);
    expect(stayRow.status).toBe("pending");

    // Both claims are atomic, so usage moved exactly twice.
    const { data: claimed } = await admin
      .from("discount_codes")
      .select("used_count")
      .eq("id", codeId)
      .single();
    expect(claimed!.used_count).toBe(2);

    // 4. Sign the owner in and inspect both bookings in the dashboard.
    const { error: pwErr } = await admin.auth.admin.updateUserById(
      ownerUserId,
      {
        password: ownerPassword,
      },
    );
    expect(pwErr, pwErr?.message).toBeNull();

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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

    // 4a. Discounted multi-night stay: rounded total, badge, code, invoicing.
    const stayCard = page
      .locator("div")
      .filter({ hasText: stayGuestName })
      .filter({ hasText: `€${FINAL_EUR.toFixed(2)}` })
      .last();
    await expect(stayCard).toBeVisible({ timeout: 20_000 });
    await expect(
      stayCard.getByText(`€${FINAL_EUR.toFixed(2)}`).first(),
    ).toBeVisible();
    // Discount badge uses a minus sign (U+2212) before the percentage.
    await expect(
      stayCard.getByText(`\u2212${DISCOUNT_PERCENT}%`).first(),
    ).toBeVisible();
    await expect(
      stayCard.getByText(new RegExp(promoCode, "i")).first(),
    ).toBeVisible();
    // The pre-discount gross must never leak into the row as the amount due.
    await expect(stayCard.getByText(`€${GROSS_EUR.toFixed(2)}`)).toHaveCount(0);

    const stayInvoiced = stayCard
      .locator("label")
      .filter({ hasText: "Invoiced" })
      .first()
      .getByRole("checkbox");
    await expect(stayInvoiced).toHaveAttribute("data-state", "unchecked");
    await stayInvoiced.click();
    await expect(stayInvoiced).toHaveAttribute("data-state", "checked", {
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
            Math.abs(Number(data?.price_eur) - FINAL_EUR) < 0.005
          );
        },
        { timeout: 15_000, intervals: [500, 1000, 2000] },
      )
      .toBe(true);

    // 4b. Same-day stay: no amount shown, and invoicing is refused.
    const dayCard = page
      .locator("div")
      .filter({ hasText: dayGuestName })
      .filter({ has: page.locator("label", { hasText: "Invoiced" }) })
      .last();
    await expect(dayCard).toBeVisible({ timeout: 20_000 });
    await expect(dayCard.getByText(/^€\d/)).toHaveCount(0);
    await expect(
      dayCard.getByText(`\u2212${DISCOUNT_PERCENT}%`).first(),
    ).toBeVisible();

    const dayInvoiced = dayCard
      .locator("label")
      .filter({ hasText: "Invoiced" })
      .first()
      .getByRole("checkbox");
    await expect(dayInvoiced).toHaveAttribute("data-state", "unchecked");
    await dayInvoiced.click();
    await expect(
      page.getByText(
        "Add a price before marking this reservation as invoiced.",
      ),
    ).toBeVisible({ timeout: 10_000 });
    await expect(dayInvoiced).toHaveAttribute("data-state", "unchecked");

    // Nothing was persisted for the unpriced booking.
    const { data: dayAfter } = await admin
      .from("reservations")
      .select("is_invoiced, price_eur")
      .eq("id", dayRow.id)
      .single();
    expect(dayAfter!.is_invoiced).toBe(false);
    expect(dayAfter!.price_eur).toBeNull();
  });
});
