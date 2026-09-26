import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
} from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import type { Page, Locator } from "@playwright/test";

/**
 * Browser-level regression: offers whose valid-until date has passed but
 * whose stored status is still draft or sent must keep the staff actions
 * Send, Confirm and Mark declined on the Offers page (a guest may have
 * accepted online and staff confirm late). A declined offer, as a control,
 * must not show them.
 *
 * Skipped unless owner/admin credentials for the shared test tenant exist:
 *   E2E_STAFF_EMAIL=...  E2E_STAFF_PASSWORD=...
 */
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;
// Alternative to a password: an already signed-in staff session (JSON with
// access_token and refresh_token) for the shared test business.
const STAFF_SESSION = process.env.E2E_STAFF_SESSION_JSON;

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const card = (page: Page, guest: string): Locator =>
  page.locator("li[id^='offer-']").filter({ hasText: guest });

test.describe("Offers page: expired draft/sent offers keep staff actions", () => {
  test.skip(
    !STAFF_SESSION && (!STAFF_EMAIL || !STAFF_PASSWORD),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD (or E2E_STAFF_SESSION_JSON) to run this spec.",
  );

  test("shows Send, Confirm and Mark declined for expired draft and sent offers", async ({
    page,
    tenant,
  }) => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } = await sb.auth.signInWithPassword(
      {
        email: STAFF_EMAIL!,
        password: STAFF_PASSWORD!,
      },
    );
    expect(signInErr, signInErr?.message).toBeNull();

    const stamp = Date.now();
    const base = {
      tenant_id: tenant.id,
      guest_email: `test-offer-expired-${stamp}@example.com`,
      event_date: futureDate(40),
      start_time: "18:00",
      end_time: "22:00",
      guests_count: 12,
      event_space: "TEST space",
      language: "en",
      expires_on: yesterday(),
    };
    const names = {
      draft: `TEST Expired Draft ${stamp}`,
      sent: `TEST Expired Sent ${stamp}`,
      declined: `TEST Declined ${stamp}`,
    };
    const { data: created, error: insErr } = await sb
      .from("offers")
      .insert([
        { ...base, status: "draft", guest_name: names.draft },
        {
          ...base,
          status: "sent",
          guest_name: names.sent,
          last_sent_at: new Date(stamp - 3 * 86400000).toISOString(),
        },
        { ...base, status: "declined", guest_name: names.declined },
      ] as any)
      .select("id");
    expect(insErr, insErr?.message).toBeNull();
    const ids = (created ?? []).map((r: any) => r.id as string);

    try {
      // Restore the staff session in the browser, English UI.
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
        .getByRole("button", { name: /^Offers/ })
        .or(page.getByRole("link", { name: /^Offers/ }))
        .first()
        .click();

      for (const guest of [names.draft, names.sent]) {
        const c = card(page, guest);
        await expect(c, `${guest} card`).toBeVisible({ timeout: 20_000 });
        await expect(c.getByText("Expired", { exact: true })).toBeVisible();
        for (const label of ["Send", "Confirm", "Mark declined"]) {
          await expect(
            c.getByRole("button", { name: label, exact: true }),
            `${guest}: ${label}`,
          ).toBeVisible();
        }
      }

      const declined = card(page, names.declined);
      await expect(declined).toBeVisible();
      for (const label of ["Send", "Confirm", "Mark declined"]) {
        await expect(
          declined.getByRole("button", { name: label, exact: true }),
        ).toHaveCount(0);
      }
      await expect(
        declined.getByRole("button", { name: "Reopen", exact: true }),
      ).toBeVisible();
    } finally {
      if (ids.length) await sb.from("offers").delete().in("id", ids);
    }
  });
});
