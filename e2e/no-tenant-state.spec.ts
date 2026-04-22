import { test, expect, Page } from "@playwright/test";

/**
 * E2E: NoTenantState surfaces correctly for authenticated users without
 * a tenant membership, and the CTA buttons take them to the right places.
 *
 * Architectural contract being verified (chosen for security — guarded
 * routes redirect rather than render protected shells):
 *
 *   /dashboard  -> wrapped in <RequireTenant>; auto-redirects to /onboarding
 *                  with a toast explaining why. The in-page NoTenantState
 *                  in Dashboard.tsx is unreachable on this route by design.
 *   /guide      -> same as /dashboard (RequireTenant -> /onboarding).
 *   /superadmin -> intentionally NOT wrapped in RequireTenant so a
 *                  superadmin without a tenant context still has a clear
 *                  recovery screen. Renders <NoTenantState attemptedArea="superadmin">
 *                  with two CTAs:
 *                     1. "Complete setup"  -> /onboarding?...
 *                     2. "Contact support" -> /support?area=superadmin&...
 *
 * The "Contact support" CTA also forwards the attempted route + email so
 * the support form is prefilled. We verify that contract here.
 *
 * This suite is opt-in: it requires a real, disposable test user with NO
 * row in `tenant_users`. Configure:
 *
 *   E2E_NO_TENANT_EMAIL     - email of the no-tenant test user
 *   E2E_NO_TENANT_PASSWORD  - that user's password
 *
 * If the env vars are missing the suite is skipped (so CI without secrets
 * stays green). The anonymous-redirect contract is covered separately in
 * `no-tenant-navigation.spec.ts`.
 */

const noTenantEmail = process.env.E2E_NO_TENANT_EMAIL;
const noTenantPassword = process.env.E2E_NO_TENANT_PASSWORD;
const enabled = Boolean(noTenantEmail && noTenantPassword);

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").first().fill(password);
  await page
    .getByRole("button", { name: /log in|sign in/i })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 20_000,
  });
}

test.describe("NoTenantState for logged-in users without a tenant", () => {
  test.skip(
    !enabled,
    "Set E2E_NO_TENANT_EMAIL and E2E_NO_TENANT_PASSWORD to run this suite."
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, noTenantEmail!, noTenantPassword!);
  });

  // ---------------------------------------------------------------------
  // /dashboard — guarded. Should redirect to /onboarding (no in-page render).
  // ---------------------------------------------------------------------
  test("/dashboard guard redirects no-tenant user to /onboarding", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/onboarding");

    // Onboarding wizard heading should be present.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // ---------------------------------------------------------------------
  // /guide — also tenant-gated. Same redirect contract as /dashboard.
  // ---------------------------------------------------------------------
  test("/guide guard redirects no-tenant user to /onboarding", async ({
    page,
  }) => {
    await page.goto("/guide");
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/onboarding");
  });

  // ---------------------------------------------------------------------
  // /superadmin — renders NoTenantState in-place (does NOT bounce). This is
  // the only route where end-users actually see the friendly "no organization"
  // screen, so we verify both CTAs work end-to-end.
  // ---------------------------------------------------------------------
  test.describe("/superadmin renders NoTenantState", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/superadmin");
      await page.waitForLoadState("networkidle");

      // Stay on /superadmin (NOT redirected). If we got bounced, the suite
      // shape doesn't match the implementation and we should fail loudly.
      expect(new URL(page.url()).pathname).toBe("/superadmin");

      // Headline that NoTenantState renders for the superadmin area.
      await expect(
        page.getByRole("heading", { name: /superadmin area unavailable/i })
      ).toBeVisible({ timeout: 10_000 });
    });

    test("shows the user's email and both CTAs", async ({ page }) => {
      // Email chip surfaces the signed-in account.
      await expect(page.getByText(noTenantEmail!)).toBeVisible();

      // Both CTAs are rendered and enabled.
      const setupBtn = page.getByRole("button", { name: /complete setup/i });
      const supportBtn = page.getByRole("button", { name: /contact support/i });
      await expect(setupBtn).toBeVisible();
      await expect(setupBtn).toBeEnabled();
      await expect(supportBtn).toBeVisible();
      await expect(supportBtn).toBeEnabled();
    });

    test("'Complete setup' CTA navigates to /onboarding", async ({ page }) => {
      await page.getByRole("button", { name: /complete setup/i }).click();
      await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
      expect(new URL(page.url()).pathname).toBe("/onboarding");

      // Wizard surface should render — i.e., we didn't loop back.
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
        timeout: 10_000,
      });
    });

    test("'Contact support' CTA opens /support with prefilled area + email", async ({
      page,
    }) => {
      await page.getByRole("button", { name: /contact support/i }).click();
      await page.waitForURL(/\/support/, { timeout: 10_000 });

      const url = new URL(page.url());
      expect(url.pathname).toBe("/support");
      // Query params set by NoTenantState's deep-link.
      expect(url.searchParams.get("area")).toBe("superadmin");
      expect(url.searchParams.get("contact")).toBe("1");
      expect(url.searchParams.get("email")).toBe(noTenantEmail!);
      // The hash anchors the contact form.
      expect(url.hash).toBe("#contact");

      // Form is rendered and the email input is prefilled with the user's
      // address. We don't assert subject/message text because they are
      // localized and may evolve; the email field is the contract.
      const emailInput = page.locator("#support-email");
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toHaveValue(noTenantEmail!);

      // The "Reported route" badge is only present when ?from=… is set;
      // for the superadmin CTA there's no `from` param (the user landed on
      // /superadmin directly), so we don't assert it here.
    });
  });
});
