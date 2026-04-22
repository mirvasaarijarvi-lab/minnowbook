import { test, expect, Page } from "@playwright/test";

/**
 * End-to-end navigation tests for users with NO tenant membership.
 *
 * The app's contract for a user without an associated tenant is:
 *   /dashboard   -> redirects to /onboarding (state.reason = "no-tenant")
 *   /onboarding  -> renders the onboarding wizard (no redirect)
 *   /guide       -> renders the Staff Guide (does not require tenant)
 *   /superadmin  -> non-system-admin without tenant -> /dashboard -> /onboarding
 *
 * Two modes:
 *   1. Anonymous (always runs): all protected routes must bounce to /login.
 *   2. Authenticated no-tenant (opt-in via env): logs in as a real test user
 *      that has NO row in tenant_users, then asserts the redirect contract.
 *
 * To enable the authenticated mode, set in CI / locally:
 *   E2E_NO_TENANT_EMAIL=test+notenant@example.com
 *   E2E_NO_TENANT_PASSWORD=...
 */

const PROTECTED_ROUTES = ["/dashboard", "/onboarding", "/guide", "/superadmin"] as const;

const noTenantEmail = process.env.E2E_NO_TENANT_EMAIL;
const noTenantPassword = process.env.E2E_NO_TENANT_PASSWORD;
const authedMode = Boolean(noTenantEmail && noTenantPassword);

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").first().fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).first().click();
  // Wait for either redirect away from /login or for an MFA / error state
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

test.describe("Anonymous users hitting protected routes", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`GET ${route} as anon redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      expect(new URL(page.url()).pathname).toBe("/login");
      await expect(page.locator("input[type='email']")).toBeVisible();
    });
  }
});

test.describe("Authenticated user without tenant membership", () => {
  test.skip(!authedMode, "Set E2E_NO_TENANT_EMAIL and E2E_NO_TENANT_PASSWORD to run");

  test.beforeEach(async ({ page }) => {
    await loginAs(page, noTenantEmail!, noTenantPassword!);
  });

  test("/dashboard redirects to /onboarding", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/onboarding");
  });

  test("/onboarding renders the wizard (no redirect loop)", async ({ page }) => {
    await page.goto("/onboarding");
    // Stay on /onboarding
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).toBe("/onboarding");
    // Onboarding shows a heading from the wizard
    await expect(
      page.getByRole("heading", { level: 1 }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("/guide renders without requiring a tenant", async ({ page }) => {
    await page.goto("/guide");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).toBe("/guide");
    // Page should render some content, not throw
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("/superadmin denies non-admin and bounces to onboarding", async ({ page }) => {
    await page.goto("/superadmin");
    // Superadmin redirects non-admin to /dashboard, which then redirects to /onboarding
    await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 10_000 });
    const finalPath = new URL(page.url()).pathname;
    expect(["/onboarding", "/dashboard"]).toContain(finalPath);
    // Ultimately it should settle on /onboarding (no tenant)
    if (finalPath === "/dashboard") {
      await page.waitForURL(/\/onboarding/, { timeout: 5_000 });
    }
    expect(new URL(page.url()).pathname).toBe("/onboarding");
  });

  test("full navigation loop: dashboard -> onboarding -> guide -> superadmin", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/onboarding/);

    await page.goto("/guide");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).toBe("/guide");

    await page.goto("/superadmin");
    await page.waitForURL(/\/onboarding/);
    expect(new URL(page.url()).pathname).toBe("/onboarding");
  });
});
