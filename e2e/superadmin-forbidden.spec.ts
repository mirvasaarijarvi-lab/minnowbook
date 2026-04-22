import { test, expect, Page, Request, Response } from "@playwright/test";

/**
 * End-to-end coverage for the `/superadmin` denial flow.
 *
 * What we verify:
 *   1. A non-system-admin who navigates to /superadmin sees the Forbidden
 *      page rendered in-place (URL preserved, no redirect).
 *   2. The Forbidden page sets `data-http-status="403"` on its <main>
 *      element so synthetic monitors and a11y tooling have a stable hook.
 *   3. The page emits a beacon to the `forbidden-status` edge function,
 *      and that beacon returns a real HTTP 403 visible in the browser
 *      network log — closing the gap between the SPA shell (always 200)
 *      and the denial's true HTTP semantics.
 *
 * Two operating modes:
 *   - Anonymous (always runs): an unauthenticated visit to /superadmin
 *     bounces to /login. We still assert the function endpoint itself
 *     returns 403 via a direct request, since that contract is what
 *     monitoring relies on regardless of which user triggers it.
 *   - Authenticated non-admin (opt-in via env): logs in as a real test
 *     user with NO system_admins membership and asserts the in-app
 *     denial flow end-to-end.
 *
 * To enable the authenticated mode locally / in CI:
 *   E2E_NON_ADMIN_EMAIL=test+nonadmin@example.com
 *   E2E_NON_ADMIN_PASSWORD=...
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const nonAdminEmail = process.env.E2E_NON_ADMIN_EMAIL;
const nonAdminPassword = process.env.E2E_NON_ADMIN_PASSWORD;
const authedMode = Boolean(nonAdminEmail && nonAdminPassword);

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").first().fill(password);
  await page
    .getByRole("button", { name: /log in|sign in/i })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

test.describe("forbidden-status edge function (always-403 contract)", () => {
  // This contract underpins the whole monitoring story — assert it
  // directly so a regression in the function is caught even if no
  // browser-side denial happens during a given CI run.
  test.skip(
    !SUPABASE_URL,
    "VITE_SUPABASE_URL is required to probe the edge function",
  );

  test("direct request to forbidden-status returns HTTP 403", async ({
    request,
  }) => {
    const url = `${SUPABASE_URL}/functions/v1/forbidden-status?area=the%20Superadmin%20area`;
    const res = await request.get(url);
    expect(
      res.status(),
      "edge function must always return 403 — monitoring depends on this",
    ).toBe(403);

    const body = await res.json();
    expect(body.status).toBe(403);
    expect(body.error).toBe("forbidden");
    expect(body.message).toContain("the Superadmin area");
  });
});

test.describe("Anonymous /superadmin visit", () => {
  test("redirects to /login (auth-gate happens before role-gate)", async ({
    page,
  }) => {
    await page.goto("/superadmin");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Authenticated non-admin /superadmin denial flow", () => {
  test.skip(
    !authedMode,
    "Set E2E_NON_ADMIN_EMAIL + E2E_NON_ADMIN_PASSWORD to run the authenticated denial flow",
  );

  test("non-admin sees Forbidden page with data-http-status=403", async ({
    page,
  }) => {
    await loginAs(page, nonAdminEmail!, nonAdminPassword!);
    await page.goto("/superadmin");

    // The Forbidden page renders in-place; URL must stay on /superadmin
    // so monitoring and audit tools can attribute the denial correctly.
    await expect(page).toHaveURL(/\/superadmin/);

    // The 403 marker copy is the most stable text-level signal.
    await expect(page.getByText(/403 · Access denied/i)).toBeVisible();

    // The headline assertion: <main data-http-status="403">. Synthetic
    // checks and a11y tooling key off this attribute.
    const main = page.getByRole("main");
    await expect(main).toHaveAttribute("data-http-status", "403");

    // Document title is part of the same observable surface — confirm it
    // matches what the README documents for monitoring.
    await expect(page).toHaveTitle(/Access denied — 403/);
  });

  test(
    "Forbidden page beacon to forbidden-status produces a real HTTP 403 in the network log",
    async ({ page }) => {
      await loginAs(page, nonAdminEmail!, nonAdminPassword!);

      // Capture the beacon while the page is mounting. The page fires
      // the request from a useEffect on mount; we wait for it explicitly
      // rather than racing the navigation.
      const beaconPromise: Promise<Response> = page.waitForResponse(
        (res: Response) =>
          res.url().includes("/functions/v1/forbidden-status") &&
          res.request().method() === "GET",
        { timeout: 10_000 },
      );

      await page.goto("/superadmin");
      const beacon = await beaconPromise;

      // The headline assertion: a REAL 403 in the network log,
      // independent of the SPA shell which is always served as 200.
      expect(
        beacon.status(),
        "forbidden-status beacon must return 403 — this is the monitorable signal that the SPA's 200 shell hides",
      ).toBe(403);

      // The query string carries the attempted area so audit pipelines
      // can correlate the network entry with the route.
      const beaconUrl = new URL(beacon.url());
      expect(beaconUrl.searchParams.get("area")).toBeTruthy();

      // Belt-and-braces: the in-page beacon-status data attribute should
      // also reflect the 403, confirming the page successfully observed
      // the response (and didn't just silently fall back to "unreachable").
      await expect(page.getByRole("main")).toHaveAttribute(
        "data-status-beacon",
        "403",
        { timeout: 10_000 },
      );
    },
  );
});
