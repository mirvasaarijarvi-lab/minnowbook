import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
} from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Browser-level regression: the Staffing needs table must follow the
 * location picked in the dashboard's location selector.
 *
 * Setup on a far-future day in the shared test business:
 *   Location A: booking 10:00-12:00 (20 guests) + A shift list, shift 10-12
 *   Location B: booking 14:00-16:00 (30 guests) + B shift list, shift 14-16
 *   All-locations shift list: shift 08-09
 *
 * Expected on screen:
 *   A picked:   10:00 row (20 guests, 1 on shift), 08:00 row, no 14:00 row
 *   B picked:   14:00 row (30 guests, 1 on shift), 08:00 row, no 10:00 row
 *   All sites:  08:00, 10:00 and 14:00 rows
 *
 * Needs an owner/admin of the test business without two-factor sign-in:
 *   E2E_STAFF_EMAIL + E2E_STAFF_PASSWORD, or E2E_STAFF_SESSION_JSON.
 * Staffing needs is a Pro feature; the account must be a superadmin or the
 * business must be on Pro/Business.
 */
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;
const STAFF_SESSION = process.env.E2E_STAFF_SESSION_JSON;

const SITE_A = {
  id: "64a56b2b-45b9-454c-80e4-76441c167b7e",
  name: "Hotel Mimmi",
};
const SITE_B = {
  id: "01e4a3ea-e883-46c2-9932-4a07a1d641db",
  name: "Second hotel",
};

const hourRow = (page: Page, hour: string) =>
  page
    .locator("table tbody tr")
    .filter({ has: page.locator("td:first-child", { hasText: hour }) });

async function pickLocation(page: Page, current: RegExp, name: string) {
  await page.getByRole("button", { name: current }).first().click();
  await page.getByRole("button", { name, exact: true }).first().click();
}

async function expectRow(
  page: Page,
  hour: string,
  guests: number,
  onShift: number,
) {
  const row = hourRow(page, hour);
  await expect(row).toHaveCount(1);
  await expect(row.locator("td").nth(1)).toHaveText(String(guests));
  await expect(row.locator("td").nth(3)).toContainText(String(onShift));
}

test.describe("Staffing needs follow the selected location", () => {
  test.skip(
    !STAFF_SESSION && (!STAFF_EMAIL || !STAFF_PASSWORD),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD (or E2E_STAFF_SESSION_JSON) to run this spec.",
  );

  test("shows only the picked location's bookings and shifts plus all-locations shifts", async ({
    page,
    tenant,
  }) => {
    // Leave room for cleanup even when a UI step times out.
    test.setTimeout(90_000);
    const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } = STAFF_SESSION
      ? await sb.auth.setSession(JSON.parse(STAFF_SESSION))
      : await sb.auth.signInWithPassword({
          email: STAFF_EMAIL!,
          password: STAFF_PASSWORD!,
        });
    expect(signInErr, signInErr?.message).toBeNull();

    const day = futureDate(420);
    const stamp = Date.now();
    const email = `test-staffing-needs-${stamp}@example.com`;
    const periodIds: string[] = [];

    try {
      const { error: resErr } = await sb.from("reservations").insert([
        {
          tenant_id: tenant.id,
          site_id: SITE_A.id,
          reservation_type: "restaurant",
          status: "confirmed",
          date: day,
          start_time: "10:00:00",
          end_time: "12:00:00",
          guests_count: 20,
          guest_name: `TEST Needs A ${stamp}`,
          guest_email: email,
          guest_phone: "+358401234567",
          language: "en",
        },
        {
          tenant_id: tenant.id,
          site_id: SITE_B.id,
          reservation_type: "restaurant",
          status: "confirmed",
          date: day,
          start_time: "14:00:00",
          end_time: "16:00:00",
          guests_count: 30,
          guest_name: `TEST Needs B ${stamp}`,
          guest_email: email,
          guest_phone: "+358401234567",
          language: "en",
        },
      ] as any);
      expect(resErr, resErr?.message).toBeNull();

      for (const [siteId, start, end] of [
        [SITE_A.id, "10:00", "12:00"],
        [SITE_B.id, "14:00", "16:00"],
        [null, "08:00", "09:00"],
      ] as const) {
        const { data: period, error: pErr } = await sb
          .from("shift_periods")
          .insert({
            tenant_id: tenant.id,
            site_id: siteId,
            start_date: day,
            weeks: 3,
            title: `TEST needs ${stamp}`,
          } as any)
          .select("id")
          .single();
        expect(pErr, pErr?.message).toBeNull();
        periodIds.push(period!.id);
        const { data: slot, error: sErr } = await sb
          .from("shift_slots")
          .insert({ tenant_id: tenant.id, period_id: period!.id } as any)
          .select("id")
          .single();
        expect(sErr, sErr?.message).toBeNull();
        const { error: shErr } = await sb.from("shifts").insert({
          tenant_id: tenant.id,
          slot_id: slot!.id,
          date: day,
          start_time: start,
          end_time: end,
        } as any);
        expect(shErr, shErr?.message).toBeNull();
      }

      const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
      await page.goto("/");
      await page.evaluate(
        ([key, session]) => {
          localStorage.setItem(key, session);
          localStorage.setItem("mimmobook-lang", "en");
        },
        [`sb-${ref}-auth-token`, JSON.stringify(signIn!.session)] as const,
      );
      await page.goto("/dashboard");
      await page
        .getByRole("button", { name: /^Staffing/ })
        .or(page.getByRole("link", { name: /^Staffing/ }))
        .first()
        .click({ timeout: 20_000 });
      await page.getByRole("tab", { name: "Staffing needs" }).click();
      await page.locator("#needs-date").fill(day);

      // Location A
      await pickLocation(
        page,
        /All sites|Hotel Mimmi|Second hotel|Restaurante|Eventos|Another site/,
        SITE_A.name,
      );
      await expectRow(page, "10:00", 20, 1);
      await expectRow(page, "08:00", 0, 1);
      await expect(hourRow(page, "14:00")).toHaveCount(0);

      // Location B
      await pickLocation(page, new RegExp(SITE_A.name), SITE_B.name);
      await expectRow(page, "14:00", 30, 1);
      await expectRow(page, "08:00", 0, 1);
      await expect(hourRow(page, "10:00")).toHaveCount(0);

      // All sites
      await pickLocation(page, new RegExp(SITE_B.name), "All sites");
      await expectRow(page, "08:00", 0, 1);
      await expectRow(page, "10:00", 20, 1);
      await expectRow(page, "14:00", 30, 1);
    } finally {
      // Deleting a shift list also removes its rows and shifts.
      if (periodIds.length)
        await sb.from("shift_periods").delete().in("id", periodIds);
      await sb
        .from("reservations")
        .delete()
        .eq("tenant_id", tenant.id)
        .eq("guest_email", email);
    }
  });
});
