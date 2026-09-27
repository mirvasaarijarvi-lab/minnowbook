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
 * Browser end-to-end: an owner opens staff management and moves themselves
 * down to staff while another approved admin remains. The change must go
 * through with no last-admin warning, and the other admin must keep their
 * role.
 *
 * Uses a throwaway business with two temporary logins, all deleted at the
 * end. Needs SUPABASE_SERVICE_ROLE_KEY.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LAST_ADMIN = "A business must keep at least one owner or admin";

test.describe("Staff management: an administrator can step down when another remains", () => {
  test.skip(
    !SERVICE_KEY || !SUPABASE_ANON_KEY,
    "Set SUPABASE_SERVICE_ROLE_KEY and the publishable key to run this spec.",
  );

  test("moves the owner to staff and keeps the other admin", async ({
    browser,
    baseURL,
  }) => {
    const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY!, {
      auth: { persistSession: false },
    });
    const email = `e2e-step-down-ui-${crypto.randomUUID()}@mimmobook.local`;
    const password = `${crypto.randomUUID()}Aa1!`;
    const otherEmail = `e2e-step-down-other-${crypto.randomUUID()}@mimmobook.local`;
    let userId: string | null = null;
    let otherId: string | null = null;
    let tenantId: string | null = null;

    try {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Step Down UI" },
      });
      if (cErr || !created.user) throw cErr ?? new Error("user not created");
      userId = created.user.id;

      const { data: tenant, error: tErr } = await admin
        .from("tenants")
        .insert({
          name: "CI step down UI test",
          slug: `ci-step-down-ui-${crypto.randomUUID().slice(0, 8)}`,
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

      const { data: other, error: oErr } = await admin.auth.admin.createUser({
        email: otherEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Other Admin UI" },
      });
      if (oErr || !other.user)
        throw oErr ?? new Error("other user not created");
      otherId = other.user.id;
      const { error: omErr } = await admin.from("tenant_users").insert({
        user_id: otherId,
        tenant_id: tenantId,
        role: "admin",
        is_approved: true,
      });
      if (omErr) throw omErr;

      const roleInDb = async () => {
        const { data, error } = await admin
          .from("tenant_users")
          .select("user_id, role, is_approved")
          .eq("tenant_id", tenantId!);
        if (error) throw error;
        return Object.fromEntries(
          (data ?? []).map((r) => [r.user_id, `${r.role}:${r.is_approved}`]),
        );
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

      // The database changes: the owner is now staff, the other admin stays.
      await expect
        .poll(roleInDb, { timeout: 20_000 })
        .toEqual({ [userId]: "staff:true", [otherId]: "admin:true" });

      // No last-admin warning was shown.
      await expect(page.getByText(LAST_ADMIN)).toHaveCount(0);

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
      if (otherId) {
        const { error } = await admin.auth.admin.deleteUser(otherId);
        if (error)
          console.error(
            "cleanup: could not delete temporary user",
            otherId,
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
