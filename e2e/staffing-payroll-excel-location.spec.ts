import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
} from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import ExcelJS from "exceljs";

/**
 * Browser-level regression: pressing Payroll Excel downloads a workbook that
 * holds only shifts from the picked location's shift lists plus the
 * all-locations lists.
 *
 * Setup on a far-future day in the shared test business: three shift lists
 * (Location A, Location B, all locations), each with one worker and one shift.
 * The test picks Location A, sets the pay period to that day, presses
 * Payroll Excel, opens the downloaded file and reads the worker names on
 * every sheet. Then the same for Location B.
 *
 * Needs an owner/admin of the test business without two-factor sign-in:
 *   E2E_STAFF_EMAIL + E2E_STAFF_PASSWORD, or E2E_STAFF_SESSION_JSON.
 * Payroll Excel is a Business feature; the account must be a superadmin or
 * the business must be on Business.
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

async function pickLocation(page: Page, current: RegExp, name: string) {
  await page.getByRole("button", { name: current }).first().click();
  await page.getByRole("button", { name, exact: true }).first().click();
}

/** Press Payroll Excel and return every cell text in the downloaded file. */
async function downloadWorkbookText(page: Page, day: string) {
  await page.getByLabel("Pay period from").fill(day);
  await page.getByLabel("to", { exact: true }).fill(day);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Payroll Excel" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/_payroll_.*\.xlsx$/);
  const path = await download.path();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path!);
  expect(wb.worksheets.length).toBeGreaterThanOrEqual(2);
  const texts: string[] = [];
  wb.eachSheet((ws) =>
    ws.eachRow((row) =>
      row.eachCell((c) => texts.push(String(c.text ?? c.value ?? ""))),
    ),
  );
  return texts.join("\n");
}

test.describe("Payroll Excel download follows the selected location", () => {
  test.skip(
    !STAFF_SESSION && (!STAFF_EMAIL || !STAFF_PASSWORD),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD (or E2E_STAFF_SESSION_JSON) to run this spec.",
  );

  test("workbook holds only the picked location's and all-locations shifts", async ({
    page,
    tenant,
  }) => {
    test.setTimeout(120_000);
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

    const day = futureDate(430);
    const stamp = Date.now();
    const names = {
      a: `TEST Payroll A ${stamp}`,
      b: `TEST Payroll B ${stamp}`,
      all: `TEST Payroll All ${stamp}`,
    };
    const periodIds: string[] = [];
    const memberIds: string[] = [];

    try {
      for (const [siteId, name] of [
        [SITE_A.id, names.a],
        [SITE_B.id, names.b],
        [null, names.all],
      ] as const) {
        const { data: member, error: mErr } = await sb
          .from("staff_members")
          .insert({ tenant_id: tenant.id, name } as any)
          .select("id")
          .single();
        expect(mErr, mErr?.message).toBeNull();
        memberIds.push(member!.id);
        const { data: period, error: pErr } = await sb
          .from("shift_periods")
          .insert({
            tenant_id: tenant.id,
            site_id: siteId,
            start_date: day,
            weeks: 3,
            title: `TEST payroll ${stamp}`,
          } as any)
          .select("id")
          .single();
        expect(pErr, pErr?.message).toBeNull();
        periodIds.push(period!.id);
        const { data: slot, error: sErr } = await sb
          .from("shift_slots")
          .insert({
            tenant_id: tenant.id,
            period_id: period!.id,
            staff_member_id: member!.id,
          } as any)
          .select("id")
          .single();
        expect(sErr, sErr?.message).toBeNull();
        const { error: shErr } = await sb.from("shifts").insert({
          tenant_id: tenant.id,
          slot_id: slot!.id,
          date: day,
          start_time: "10:00",
          end_time: "18:00",
        } as any);
        expect(shErr, shErr?.message).toBeNull();
      }

      const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
      await page.goto("/");
      await page.evaluate(
        ([key, session]) => {
          localStorage.setItem(key, session);
          localStorage.setItem("mimmobook-lang", "en");
          localStorage.setItem("mimmobook-tour-completed", "true");
          localStorage.setItem("cookie-consent", "rejected");
        },
        [`sb-${ref}-auth-token`, JSON.stringify(signIn!.session)] as const,
      );
      await page.goto("/dashboard");
      await page
        .getByRole("button", { name: /^Staffing/ })
        .or(page.getByRole("link", { name: /^Staffing/ }))
        .first()
        .click({ timeout: 20_000 });

      // Location A: A's worker and the all-locations worker only.
      await pickLocation(
        page,
        /All sites|Hotel Mimmi|Second hotel|Restaurante|Eventos|Another site/,
        SITE_A.name,
      );
      let text = await downloadWorkbookText(page, day);
      expect(text).toContain(names.a);
      expect(text).toContain(names.all);
      expect(text).not.toContain(names.b);

      // Location B: B's worker and the all-locations worker only.
      await pickLocation(page, new RegExp(SITE_A.name), SITE_B.name);
      text = await downloadWorkbookText(page, day);
      expect(text).toContain(names.b);
      expect(text).toContain(names.all);
      expect(text).not.toContain(names.a);
    } finally {
      // Deleting a shift list also removes its rows and shifts.
      if (periodIds.length)
        await sb.from("shift_periods").delete().in("id", periodIds);
      if (memberIds.length)
        await sb.from("staff_members").delete().in("id", memberIds);
    }
  });
});
