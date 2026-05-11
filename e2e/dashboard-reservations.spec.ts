import { test, expect } from "@playwright/test";

test.describe("Dashboard reservations route", () => {
  test("redirects unauthenticated users away from /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // App should bounce to /auth or /login when no session exists.
    await page.waitForURL(/\/(auth|login)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/(auth|login)/);
  });

  test("login page exposes the email/password fields used to reach dashboard", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']").first()).toBeVisible();
  });
});
