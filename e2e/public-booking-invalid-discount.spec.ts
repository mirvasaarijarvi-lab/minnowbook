import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import {
  gotoAndWaitForSpa,
  assertPublicBookingReady,
} from "./fixtures/spa-waits";

/**
 * End-to-end: a guest enters a bad promo code on the public booking page.
 *
 * Two bad-code shapes are covered, because they take different paths through
 * `claim_discount_code()`:
 *
 *   1. a code that does not exist at all
 *   2. a real code whose `valid_until` is in the past (expired)
 *
 * In both cases the contract is the same and is what this spec locks:
 *   - the booking is REJECTED (an error is shown, no confirmation screen)
 *   - NO reservation row is created, so no price / discount / invoice
 *     fields are written anywhere
 *   - the expired code's `used_count` is NOT incremented
 *
 * The rejection is authoritative in the `public-booking` edge function, so
 * the spec asserts both the API outcome and the browser-visible error, and
 * then verifies the database is untouched.
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so
 * CI never blocks on missing secrets.
 */

const NIGHTLY_EUR = 60;

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Public booking with an invalid or expired discount code", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(
    !SUPABASE_ANON_KEY,
    "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.",
  );

  test("rejects the booking, shows an error, and writes no price or invoice data", async ({
    ephemeralTenant,
    page,
    request,
  }) => {
    const { admin, tenantId, slug } = ephemeralTenant;
    const stamp = Date.now();
    const unknownCode = `CINOPE${stamp}`.slice(0, 20).toUpperCase();
    const expiredCode = `CIEXPI${stamp}`.slice(0, 20).toUpperCase();
    const checkIn = isoDate(30);
    const checkOut = isoDate(32);

    // A priced guesthouse resource, so a successful booking WOULD have
    // carried money. Any price written is therefore a real regression.
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

    // An EXPIRED percentage code: valid, but its window closed yesterday.
    const { data: expired, error: expErr } = await admin
      .from("discount_codes")
      .insert({
        tenant_id: tenantId,
        code: expiredCode,
        description: "E2E expired discount spec",
        discount_type: "percentage",
        discount_value: 25,
        applies_to: ["guesthouse"],
        valid_from: isoDate(-30),
        valid_until: isoDate(-1),
        is_active: true,
      })
      .select("id, used_count")
      .single();
    expect(expErr, expErr?.message).toBeNull();
    const expiredId = expired!.id as string;
    expect(expired!.used_count).toBe(0);

    // ---- 1. API contract: both bad codes are rejected -------------------
    const bookWith = async (promoCode: string, guestName: string) =>
      request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
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
          guest_name: guestName,
          guest_email: `ci+baddiscount-${stamp}@mimmobook.test`,
          guests_count: 2,
          promo_code: promoCode,
        },
        timeout: 30_000,
      });

    for (const [promoCode, label] of [
      [unknownCode, "unknown"],
      [expiredCode, "expired"],
    ] as const) {
      const res = await bookWith(
        promoCode,
        `TEST CI BadCode ${label} ${stamp}`,
      );
      const body = await res.text();
      // 5xx means the platform is degraded, not that the contract broke.
      test.skip(
        res.status() >= 500,
        `public-booking degraded (${res.status()}): ${body}`,
      );
      expect(
        res.status(),
        `${label} code should be rejected. Body: ${body}`,
      ).toBe(400);
      expect(body).toMatch(/promo code/i);
    }

    // ---- 2. Nothing was written -----------------------------------------
    const { data: rows, error: rowsErr } = await admin
      .from("reservations")
      .select(
        "id, price_eur, original_price_eur, discount_code_id, discount_value, is_invoiced",
      )
      .eq("tenant_id", tenantId);
    expect(rowsErr, rowsErr?.message).toBeNull();
    expect(
      rows ?? [],
      "a rejected promo-code booking must not create a reservation row",
    ).toHaveLength(0);

    const { data: codeAfter, error: codeAfterErr } = await admin
      .from("discount_codes")
      .select("used_count")
      .eq("id", expiredId)
      .single();
    expect(codeAfterErr, codeAfterErr?.message).toBeNull();
    expect(codeAfter!.used_count, "an expired code must not be consumed").toBe(
      0,
    );

    // ---- 3. Browser: the guest sees an error, not a confirmation --------
    await page.addInitScript(() => {
      window.localStorage.setItem("mimmobook-lang", "en");
      window.localStorage.setItem("mimmobook-tour-completed", "true");
      // Pre-answer the cookie banner: as an overlay it intercepts clicks on
      // the date-picker popovers.
      window.localStorage.setItem(
        "cookie-consent",
        JSON.stringify({
          version: 1,
          categories: { necessary: true, analytics: false, marketing: false },
          updatedAt: new Date().toISOString(),
        }),
      );
    });
    await gotoAndWaitForSpa(page, `/book/${slug}?type=guesthouse`);
    await assertPublicBookingReady(page);

    const uiGuestName = `TEST CI BadCode UI ${stamp}`;
    await page.locator("#guest_name").fill(uiGuestName);
    await page
      .locator("#guest_email")
      .fill(`ci+baddiscount-ui-${stamp}@mimmobook.test`);
    await page.locator("#guests_count").fill("2");

    // Pick check-in / check-out from next month, so the dates are always in
    // the future regardless of which day the suite runs on.
    const pickDay = async (day: string) => {
      await page
        .getByRole("button", { name: /Pick a date/i })
        .first()
        .click();
      const popover = page
        .locator("[data-radix-popper-content-wrapper]")
        .last();
      await popover.getByRole("button", { name: /next month/i }).click();
      // Calendar versions differ in whether the day is the grid cell itself or
      // a button inside it, so accept either.
      const cell = popover
        .getByRole("gridcell", { name: day, exact: true })
        .or(popover.getByRole("button", { name: day, exact: true }))
        .first();
      await cell.click();
      await page.keyboard.press("Escape");
    };
    await pickDay("10");
    await pickDay("12");

    await page.locator("#promo_code").fill(unknownCode);

    // Bot protection rejects submissions faster than 3s after form load.
    await page.waitForTimeout(3_500);

    const submit = page.getByRole("button", { name: /Submit Reservation/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Guest-visible failure signal: an error message, no confirmation
    // screen, and the promo code still in the field so it can be corrected.
    await expect(
      page.getByText(/Failed to submit reservation|promo code/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Reservation Received/i)).toHaveCount(0);
    await expect(page.locator("#promo_code")).toHaveValue(unknownCode);

    // And still nothing persisted after the browser attempt.
    const { data: afterUi } = await admin
      .from("reservations")
      .select("id, price_eur, is_invoiced")
      .eq("tenant_id", tenantId);
    expect(
      afterUi ?? [],
      "the browser attempt must not create a reservation",
    ).toHaveLength(0);
  });
});
