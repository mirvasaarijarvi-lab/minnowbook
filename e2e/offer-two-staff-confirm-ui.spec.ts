import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TEST_TENANT_ID,
  futureDate,
  makeTestGuest,
} from "./fixtures/test-tenant";
import type { Browser, Page, Locator } from "@playwright/test";
import {
  ensureOfferStaffAccounts,
  type OfferStaffAccount,
} from "./fixtures/offer-staff-accounts";

/**
 * Browser end-to-end: two DIFFERENT staff members (each in their own browser,
 * signed in without two-factor) open the Offers page and press Confirm on the
 * same offer at the same moment. Exactly one reservation may be created.
 *
 * If the page asks staff to check prices first, both fill in a price and
 * press "Confirm offer" in that window at the same moment instead.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY to set up the two test logins.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const card = (page: Page, guest: string): Locator =>
  page.locator("li[id^='offer-']").filter({ hasText: guest });

async function openOffersAs(
  browser: Browser,
  staff: OfferStaffAccount,
  baseURL: string | undefined,
): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 1800 },
  });
  const page = await context.newPage();
  const { data } = await staff.client.auth.getSession();
  expect(data.session, `${staff.email} has a session`).toBeTruthy();
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  await page.goto("/");
  await page.evaluate(
    ([key, session]) => {
      localStorage.setItem(key, session);
      localStorage.setItem("mimmobook-lang", "en");
    },
    [`sb-${ref}-auth-token`, JSON.stringify(data.session)] as const,
  );
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: /^Offers/ })
    .or(page.getByRole("link", { name: /^Offers/ }))
    .first()
    .click();
  return page;
}

test.describe("Offers page: two staff confirm the same offer at once", () => {
  test.skip(
    !SERVICE_KEY || !SUPABASE_ANON_KEY,
    "Set SUPABASE_SERVICE_ROLE_KEY and the publishable key to run this spec.",
  );

  test("pressing Confirm in two browsers at the same moment creates one reservation", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const [a, b] = await ensureOfferStaffAccounts({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      serviceKey: SERVICE_KEY!,
      tenantId: TEST_TENANT_ID,
    });
    expect(a.userId).not.toBe(b.userId);

    const guest = makeTestGuest("UiTwoStaff");
    const { data: offer, error } = await a.client
      .from("offers")
      .insert({
        tenant_id: TEST_TENANT_ID,
        status: "sent",
        ...guest,
        event_date: futureDate(58),
        start_time: "18:00",
        end_time: "22:00",
        guests_count: 12,
        event_space: "TEST space",
        language: "en",
        expires_on: futureDate(10),
      } as any)
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    const offerId = offer!.id as string;

    const pages: Page[] = [];
    try {
      pages.push(
        ...(await Promise.all([
          openOffersAs(browser, a, baseURL),
          openOffersAs(browser, b, baseURL),
        ])),
      );
      const confirmButtons = pages.map((p) =>
        card(p, guest.guest_name).getByRole("button", {
          name: "Confirm",
          exact: true,
        }),
      );
      for (const btn of confirmButtons)
        await expect(btn).toBeVisible({ timeout: 30_000 });

      // Both staff members press Confirm at the same moment.
      await Promise.all(confirmButtons.map((btn) => btn.click()));

      // If the page asks for prices first, fill them in and confirm together.
      const priceButtons = pages.map((p) =>
        p.getByTestId("offer-price-confirm"),
      );
      const asked = await Promise.all(
        priceButtons.map((btn) =>
          btn
            .waitFor({ state: "visible", timeout: 5_000 })
            .then(() => true)
            .catch(() => false),
        ),
      );
      if (asked.some(Boolean)) {
        expect(asked, "both staff get the same price check").toEqual([
          true,
          true,
        ]);
        for (const p of pages) {
          const dialog = p.getByRole("dialog");
          const inputs = dialog.locator("input[id^='price-']");
          for (let i = 0; i < (await inputs.count()); i++) {
            const input = inputs.nth(i);
            if (await input.isEnabled()) await input.fill("100");
          }
        }
        for (const btn of priceButtons) await expect(btn).toBeEnabled();
        await Promise.all(priceButtons.map((btn) => btn.click()));
      }

      // Both pages report success and neither shows the error message.
      for (const p of pages) {
        await expect(p.getByText("Offer confirmed").first()).toBeVisible({
          timeout: 30_000,
        });
        await expect(p.getByText("Error confirming offer")).toHaveCount(0);
      }

      // Exactly one reservation exists for the guest, and the offer points at it.
      await expect
        .poll(async () => {
          const { data } = await a.client
            .from("offers")
            .select("status")
            .eq("id", offerId)
            .single();
          return data?.status;
        })
        .toBe("confirmed");
      const { data: rows, error: resErr } = await b.client
        .from("reservations")
        .select("id,status,guests_count")
        .eq("tenant_id", TEST_TENANT_ID)
        .eq("guest_email", guest.guest_email);
      expect(resErr, resErr?.message).toBeNull();
      expect(rows).toHaveLength(1);
      expect(rows![0].status).toBe("confirmed");
      expect(rows![0].guests_count).toBe(12);
      const { data: saved } = await a.client
        .from("offers")
        .select("reservation_ids")
        .eq("id", offerId)
        .single();
      expect(saved?.reservation_ids).toEqual([rows![0].id]);

      // After reloading, neither staff member can confirm it again.
      for (const p of pages) {
        await p.reload();
        await p
          .getByRole("button", { name: /^Offers/ })
          .or(p.getByRole("link", { name: /^Offers/ }))
          .first()
          .click();
        const c = card(p, guest.guest_name);
        await expect(c).toBeVisible({ timeout: 30_000 });
        await expect(
          c.getByRole("button", { name: "Confirm", exact: true }),
        ).toHaveCount(0);
      }
    } finally {
      for (const p of pages) await p.context().close();
      const { data: left } = await a.client
        .from("reservations")
        .select("id")
        .eq("tenant_id", TEST_TENANT_ID)
        .eq("guest_email", guest.guest_email);
      if (left?.length)
        await a.client
          .from("reservations")
          .delete()
          .in(
            "id",
            left.map((r) => r.id),
          );
      await a.client.from("offers").delete().eq("id", offerId);
    }
  });
});
