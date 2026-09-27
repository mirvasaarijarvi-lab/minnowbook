import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expectWelcomeTourDismissed,
  markWelcomeTourSeen,
} from "./fixtures/welcome-tour";

/**
 * Browser end-to-end: the only owner of a business opens staff management
 * and tries to move themselves down to staff. The page must show the
 * last-admin warning, and both the screen and the database must still show
 * them as owner.
 *
 * Uses a throwaway business with one temporary owner login, both deleted at
 * the end. Needs SUPABASE_SERVICE_ROLE_KEY.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LAST_ADMIN = "A business must keep at least one owner or admin";

test.describe("Staff management: the last administrator cannot step down", () => {
  test.skip(
    !SERVICE_KEY || !SUPABASE_ANON_KEY,
    "Set SUPABASE_SERVICE_ROLE_KEY and the publishable key to run this spec.",
  );

  test("shows the last-admin warning and keeps the owner role", async ({
    browser,
    baseURL,
  }) => {
    const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY!, {
      auth: { persistSession: false },
    });
    const email = `e2e-last-admin-ui-${crypto.randomUUID()}@mimmobook.local`;
    const password = `${crypto.randomUUID()}Aa1!`;
    let userId: string | null = null;
    let tenantId: string | null = null;

    try {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Last Admin UI" },
      });
      if (cErr || !created.user) throw cErr ?? new Error("user not created");
      userId = created.user.id;

      const { data: tenant, error: tErr } = await admin
        .from("tenants")
        .insert({
          name: "CI last admin UI test",
          slug: `ci-last-admin-ui-${crypto.randomUUID().slice(0, 8)}`,
          owner_user_id: userId,
        })
        .select("id")
        .single();
      if (tErr || !tenant) throw tErr ?? new Error("tenant not created");
      tenantId = tenant.id;

      const { error: mErr } = await admin.from("tenant_users").insert({
        user_id: userId,
        tenant_id: tenantId,
        role: "owner",
        is_approved: true,
      });
      if (mErr) throw mErr;

      const roleInDb = async () => {
        const { data, error } = await admin
          .from("tenant_users")
          .select("role, is_approved")
          .eq("user_id", userId!)
          .eq("tenant_id", tenantId!);
        if (error) throw error;
        return data;
      };

      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      });
      const { data: signIn, error: sErr } = await anon.auth.signInWithPassword({
        email,
        password,
      });
      if (sErr || !signIn.session) throw sErr ?? new Error("no session");

      const context = await browser.newContext({
        baseURL,
        viewport: { width: 1280, height: 1800 },
      });
      await markWelcomeTourSeen(context);
      const page = await context.newPage();
      // Staff management only answers pages on mimmobook.com addresses, and
      // the test app runs on a local address. Forward its calls with the
      // mimmobook.com address; the sign-in and request are unchanged.
      await page.route("**/functions/v1/admin-users", async (route) => {
        const req = route.request();
        const cors = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "POST, OPTIONS",
        };
        if (req.method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: cors });
          return;
        }
        const headers = { ...req.headers(), origin: "https://mimmobook.com" };
        delete headers["referer"];
        const resp = await route.fetch({ headers });
        await route.fulfill({
          status: resp.status(),
          body: await resp.body(),
          headers: {
            ...cors,
            "content-type":
              resp.headers()["content-type"] ?? "application/json",
          },
        });
      });
      const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
      await page.goto("/");
      await page.evaluate(
        ([key, session]) => {
          localStorage.setItem(key, session);
          localStorage.setItem("mimmobook-lang", "en");
        },
        [`sb-${ref}-auth-token`, JSON.stringify(signIn.session)] as const,
      );
      await page.goto("/dashboard");
      await expectWelcomeTourDismissed(page);

      await page
        .getByRole("button", { name: /^Admin/ })
        .or(page.getByRole("link", { name: /^Admin/ }))
        .first()
        .click();

      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toBeVisible({ timeout: 20_000 });
      const roleSelect = row.getByRole("combobox").first();
      await expect(roleSelect).toHaveText(/Owner/i);

      await roleSelect.click();
      await page.getByRole("option", { name: /^Staff$/i }).click();

      // The warning appears on screen.
      await expect(page.getByText(LAST_ADMIN).first()).toBeVisible({
        timeout: 15_000,
      });

      // The screen still shows them as owner, after a reload as well.
      await expect(roleSelect).toHaveText(/Owner/i);
      await page.reload();
      await expect(
        page
          .getByRole("row")
          .filter({ hasText: email })
          .getByRole("combobox")
          .first(),
      ).toHaveText(/Owner/i, { timeout: 20_000 });

      // And the database is unchanged.
      expect(await roleInDb()).toEqual([{ role: "owner", is_approved: true }]);

      await context.close();
    } finally {
      if (tenantId) {
        const { error } = await admin
          .from("tenants")
          .delete()
          .eq("id", tenantId);
        if (error)
          console.error(
            "cleanup: could not delete test business",
            tenantId,
            error.message,
          );
      }
      if (userId) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error)
          console.error(
            "cleanup: could not delete temporary user",
            userId,
            error.message,
          );
      }
    }
  });
});
