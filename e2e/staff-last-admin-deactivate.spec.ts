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
 * and tries to remove (turn off) their own access with the Remove button.
 * Staff management has no separate "deactivate" switch; Remove is how an
 * account is taken out of a business. The page must refuse with an error,
 * the owner must stay listed as owner, and their login must stay active
 * (not banned, not deleted).
 *
 * Uses a throwaway business with one temporary owner login, both deleted at
 * the end. Needs SUPABASE_SERVICE_ROLE_KEY.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Either refusal is correct: removing yourself is blocked in staff
// management, and the database refuses to leave a business with no admin.
const REFUSED =
  /Cannot delete yourself|A business must keep at least one owner or admin/;

test.describe("Staff management: the last administrator cannot be deactivated", () => {
  test.skip(
    !SERVICE_KEY || !SUPABASE_ANON_KEY,
    "Set SUPABASE_SERVICE_ROLE_KEY and the publishable key to run this spec.",
  );

  test("refuses removal and keeps the account active", async ({
    browser,
    baseURL,
  }) => {
    const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY!, {
      auth: { persistSession: false },
    });
    const email = `e2e-last-admin-remove-${crypto.randomUUID()}@mimmobook.local`;
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
          name: "CI last admin remove test",
          slug: `ci-last-admin-remove-${crypto.randomUUID().slice(0, 8)}`,
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
      await expect(row.getByRole("combobox").first()).toHaveText(/Owner/i);

      // The Remove button is the last button in the row; confirm the dialog.
      await row.getByRole("button").last().click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /^Remove$/ }).click();

      // The page refuses, and the owner stays in the list as owner.
      await expect(page.getByText(REFUSED).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(row).toBeVisible();
      await expect(row.getByRole("combobox").first()).toHaveText(/Owner/i);

      // The database still has them as an approved owner.
      expect(await roleInDb()).toEqual([{ role: "owner", is_approved: true }]);

      // And their login is still active: not banned, not deleted.
      const { data: still, error: gErr } =
        await admin.auth.admin.getUserById(userId);
      if (gErr) throw gErr;
      const u = still.user as {
        banned_until?: string | null;
        deleted_at?: string | null;
      };
      expect(u.banned_until ?? null).toBeNull();
      expect(u.deleted_at ?? null).toBeNull();

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
