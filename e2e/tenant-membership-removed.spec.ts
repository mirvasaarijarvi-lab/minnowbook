import { test, expect, Page } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * E2E: Tenant membership revoked while the user is on /dashboard.
 *
 * Contract being verified:
 *   1. User is signed in and viewing /dashboard with an active tenant.
 *   2. An admin (simulated here via the service role key) deletes the user's
 *      row from `tenant_users`.
 *   3. The realtime subscription in `useTenant` fires a DELETE event, which:
 *        - Shows a sonner toast: "Your access to this organization has
 *          been removed."
 *        - Invalidates the tenant query so `tenantId` becomes null.
 *        - The app surfaces the no-tenant state and the user is moved to
 *          /onboarding (either automatically or via the "Complete setup" CTA
 *          rendered by NoTenantState).
 *
 * This test is opt-in. It requires a *disposable* tenant + user in the
 * target Supabase project, since it deletes the membership row. Set:
 *
 *   E2E_SUPABASE_URL                  - Project URL (https://xxx.supabase.co)
 *   E2E_SUPABASE_SERVICE_ROLE_KEY     - Service role key (server-side only,
 *                                       NEVER ship to the browser)
 *   E2E_MEMBERSHIP_TEST_EMAIL         - Email of the disposable test user
 *   E2E_MEMBERSHIP_TEST_PASSWORD      - Password for that user
 *   E2E_MEMBERSHIP_TEST_TENANT_ID     - Tenant ID the user belongs to
 *
 * After the test runs, the membership is restored in `afterAll` so the
 * fixture can be re-used. If restoration fails, the test logs the error
 * loudly so the operator knows to re-seed manually.
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.E2E_MEMBERSHIP_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_MEMBERSHIP_TEST_PASSWORD;
const TEST_TENANT_ID = process.env.E2E_MEMBERSHIP_TEST_TENANT_ID;

const liveMode =
  Boolean(SUPABASE_URL) &&
  Boolean(SERVICE_ROLE_KEY) &&
  Boolean(TEST_EMAIL) &&
  Boolean(TEST_PASSWORD) &&
  Boolean(TEST_TENANT_ID);

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").first().fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 20_000,
  });
}

test.describe("Tenant membership revoked mid-session", () => {
  test.skip(
    !liveMode,
    "Set E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_MEMBERSHIP_TEST_EMAIL, E2E_MEMBERSHIP_TEST_PASSWORD, and E2E_MEMBERSHIP_TEST_TENANT_ID to run this test."
  );

  // Run serially — we mutate shared fixture state (tenant_users row).
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let userId: string | null = null;
  let originalRole: string | null = null;
  let originalCustomRoleKey: string | null = null;
  let originalDisplayName: string | null = null;
  let originalIsApproved: boolean | null = null;

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Resolve the test user's auth UID via the admin API so we can target
    // the exact tenant_users row to delete (and later restore).
    const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    const match = usersPage.users.find((u) => u.email === TEST_EMAIL);
    if (!match) {
      throw new Error(
        `E2E test user ${TEST_EMAIL} not found. Create it (and assign it to tenant ${TEST_TENANT_ID}) before running this suite.`
      );
    }
    userId = match.id;

    // Snapshot the existing membership so we can restore it after the test.
    const { data: membership, error: memErr } = await admin
      .from("tenant_users")
      .select("role, custom_role_key, display_name, is_approved")
      .eq("user_id", userId)
      .eq("tenant_id", TEST_TENANT_ID!)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership) {
      throw new Error(
        `Test user ${TEST_EMAIL} is not a member of tenant ${TEST_TENANT_ID}. Seed the membership before running this suite.`
      );
    }
    originalRole = (membership as any).role ?? "staff";
    originalCustomRoleKey = (membership as any).custom_role_key ?? null;
    originalDisplayName = (membership as any).display_name ?? null;
    originalIsApproved = (membership as any).is_approved ?? true;
  });

  test.afterAll(async () => {
    if (!admin || !userId || !originalRole) return;
    // Restore the membership so the fixture is reusable. Use upsert so a
    // partial run that failed before deletion is still safe.
    const { error } = await admin.from("tenant_users").upsert(
      {
        user_id: userId,
        tenant_id: TEST_TENANT_ID!,
        role: originalRole,
        custom_role_key: originalCustomRoleKey,
        display_name: originalDisplayName,
        is_approved: originalIsApproved ?? true,
      },
      { onConflict: "tenant_id,user_id" }
    );
    if (error) {
      // Don't swallow — surface so the operator re-seeds manually.
      // eslint-disable-next-line no-console
      console.error(
        "[e2e tenant-membership-removed] FAILED to restore membership:",
        error
      );
    }
  });

  test("removes membership while on /dashboard, shows toast, and lands on /onboarding", async ({
    page,
  }) => {
    // 1. Sign in and reach the dashboard with a real, active tenant.
    await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/dashboard");

    // Wait for the dashboard to fully hydrate so the realtime channel in
    // useTenant is actually subscribed before we delete the row.
    await page.waitForLoadState("networkidle");

    // 2. Capture sonner toasts. Sonner renders into [data-sonner-toaster].
    //    We listen via the DOM rather than the toast() API so we observe
    //    exactly what the user sees.
    const toastLocator = page
      .locator("[data-sonner-toaster]")
      .getByText(/access to this organization has been removed/i);

    // 3. Delete the user's tenant_users row using the service role (this
    //    simulates an admin removing the member from the team).
    const { error: delErr } = await admin
      .from("tenant_users")
      .delete()
      .eq("user_id", userId!)
      .eq("tenant_id", TEST_TENANT_ID!);
    expect(delErr, "service-role delete should succeed").toBeNull();

    // 4. The realtime DELETE event should trigger the toast.
    await expect(toastLocator).toBeVisible({ timeout: 15_000 });

    // 5. The app should land on /onboarding. Either:
    //      - the route guard auto-redirects, OR
    //      - NoTenantState is rendered with a "Complete setup" CTA the user
    //        has to click. We accept either path so the test reflects the
    //        documented contract ("user ends up on /onboarding").
    const settledOnOnboarding = await Promise.race([
      page
        .waitForURL(/\/onboarding/, { timeout: 8_000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByRole("button", { name: /complete setup/i })
        .waitFor({ state: "visible", timeout: 8_000 })
        .then(() => true)
        .catch(() => false),
    ]);

    expect(
      settledOnOnboarding,
      "after membership removal the user should either be redirected to /onboarding or see the no-tenant Complete setup CTA"
    ).toBe(true);

    if (!page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /complete setup/i }).click();
      await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    }

    expect(new URL(page.url()).pathname).toBe("/onboarding");

    // 6. The onboarding wizard should render (heading visible, no redirect
    //    loop back to /dashboard now that tenantId is null).
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
