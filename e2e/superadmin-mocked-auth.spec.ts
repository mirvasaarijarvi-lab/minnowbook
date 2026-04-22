import { test, expect, Page, Route } from "@playwright/test";

/**
 * Lightweight E2E coverage for `/superadmin` across three auth states,
 * driven entirely by Playwright route mocking — no real Supabase users,
 * no test fixtures, no env vars required. Runs on every CI invocation.
 *
 * The three states we exercise:
 *
 *   1. **Anonymous** — no session in localStorage. `<ProtectedRoute>` must
 *      bounce to `/login` before `<SystemAdminRoute>` ever evaluates the
 *      role, so we must NOT see the Forbidden UI and the audit / status
 *      beacons must NOT fire.
 *
 *   2. **Authenticated non-admin** — a fake session is seeded into
 *      localStorage and the `system_admins` lookup is mocked to return
 *      no row. The Forbidden page must render in-place at `/superadmin`
 *      with `data-http-status="403"` and the status beacon must observe
 *      a real HTTP 403 from the (mocked) edge function.
 *
 *   3. **Authenticated system admin** — same fake session, but the
 *      `system_admins` lookup returns a row. The Superadmin page must
 *      render and the Forbidden UI must NOT appear.
 *
 * Why route-mocking instead of real auth:
 *   - Keeps the spec deterministic and runnable in any environment
 *     (local, CI, ephemeral previews) without secrets.
 *   - Lets us assert beacon and status behavior without requiring the
 *     real edge functions to be deployed against the preview build.
 *   - The real auth + audit flow is already covered by the heavier
 *     `superadmin-forbidden.spec.ts` (opt-in via env vars) and the
 *     integration test in `forbidden-access-audit.integration.test.ts`.
 *     This file fills the gap for the always-on smoke loop.
 */

// Stable fakes used across the suite. `auth-token` shape mirrors what
// supabase-js v2 persists — the project's session detection only checks
// for the presence of a stored token; it doesn't validate the JWT.
const FAKE_USER_ID = "00000000-0000-0000-0000-0000deadbeef";
const FAKE_ACCESS_TOKEN = "fake.jwt.token";
const FAKE_REFRESH_TOKEN = "fake-refresh";

/**
 * Read the supabase project ref from VITE_SUPABASE_URL so the auth token
 * key matches what the SDK actually looks up. Falls back to a sentinel
 * that will simply produce no session (which is fine for the anonymous
 * test, and the authed tests skip themselves below).
 */
function projectRef(): string | null {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) return null;
  const m = url.match(/^https?:\/\/([^.]+)\./);
  return m?.[1] ?? null;
}

/**
 * Inject a fake supabase session into localStorage BEFORE the app mounts.
 * Uses `addInitScript` so it runs on every navigation in the page,
 * surviving the SPA's own hydration.
 */
async function seedFakeSession(page: Page, ref: string) {
  const storageKey = `sb-${ref}-auth-token`;
  const session = {
    access_token: FAKE_ACCESS_TOKEN,
    refresh_token: FAKE_REFRESH_TOKEN,
    token_type: "bearer",
    // Far future so the SDK doesn't trigger an immediate refresh.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    expires_in: 60 * 60 * 24,
    user: {
      id: FAKE_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "mocked@example.com",
      app_metadata: {},
      user_metadata: {},
    },
  };
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: session },
  );
}

/**
 * Mock the `system_admins` PostgREST lookup so we control whether the
 * role gate sees the user as an admin. Matches any query against the
 * `system_admins` table.
 */
async function mockSystemAdminLookup(page: Page, isAdmin: boolean) {
  await page.route(/\/rest\/v1\/system_admins/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": isAdmin ? "0-0/1" : "*/0" },
      body: JSON.stringify(
        isAdmin ? [{ user_id: FAKE_USER_ID, created_at: new Date().toISOString() }] : [],
      ),
    });
  });
}

/**
 * Mock the always-403 status beacon endpoint so the assertion is a
 * pure browser-network observation, independent of whether the real
 * edge function is reachable from the test environment.
 */
async function mockForbiddenStatusBeacon(page: Page) {
  await page.route(/\/functions\/v1\/forbidden-status/, async (route: Route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        status: 403,
        error: "forbidden",
        message: `Access to ${url.searchParams.get("area") ?? "unknown"} is denied.`,
      }),
    });
  });
}

/**
 * Mock the audit-log beacon so the page can resolve its
 * `data-audit-status` attribute deterministically without writing
 * to the real audit_log table.
 */
async function mockAuditLogBeacon(page: Page) {
  await page.route(
    /\/functions\/v1\/log-forbidden-access/,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          logged: true,
          userId: FAKE_USER_ID,
          tenantId: null,
          at: new Date().toISOString(),
        }),
      });
    },
  );
}

/**
 * Quietly stub out other PostgREST calls the dashboard chrome may make
 * after auth resolves, so we don't get noisy console errors that could
 * race the assertions. Returning empty arrays is harmless — none of
 * these tests care about dashboard content.
 */
async function stubOtherRestCalls(page: Page) {
  await page.route(/\/rest\/v1\//, async (route: Route) => {
    // Only intercept calls that haven't already been handled (system_admins
    // is more specific and registered first, so it wins).
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "*/0" },
      body: "[]",
    });
  });
}

const ref = projectRef();

test.describe("/superadmin — mocked auth states (lightweight E2E)", () => {
  test("anonymous: redirects to /login, no Forbidden UI, no beacons", async ({
    page,
  }) => {
    // Track whether either denial beacon fires. Anonymous denials are
    // caught by the auth gate before the role gate runs, so neither
    // should ever be invoked.
    let statusBeaconHits = 0;
    let auditBeaconHits = 0;
    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("/functions/v1/forbidden-status")) statusBeaconHits++;
      if (u.includes("/functions/v1/log-forbidden-access")) auditBeaconHits++;
    });

    await page.goto("/superadmin");
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    expect(page.url()).toContain("/login");
    // The Forbidden marker must NOT be present — the user never reached
    // the role gate.
    await expect(page.locator('[data-http-status="403"]')).toHaveCount(0);
    expect(statusBeaconHits, "status beacon must not fire for anonymous").toBe(0);
    expect(auditBeaconHits, "audit beacon must not fire for anonymous").toBe(0);
  });

  test.describe("authenticated states (require VITE_SUPABASE_URL)", () => {
    test.skip(
      !ref,
      "VITE_SUPABASE_URL is required to compute the supabase auth-token key",
    );

    test("non-admin: Forbidden renders in-place with data-http-status=403 and a real 403 in the network log", async ({
      page,
    }) => {
      await seedFakeSession(page, ref!);
      await mockSystemAdminLookup(page, false);
      await mockForbiddenStatusBeacon(page);
      await mockAuditLogBeacon(page);
      await stubOtherRestCalls(page);

      // Wait for the always-403 beacon explicitly so we can assert on
      // the real network status the SPA shell would otherwise hide.
      const beaconPromise = page.waitForResponse(
        (res) =>
          res.url().includes("/functions/v1/forbidden-status") &&
          res.request().method() === "GET",
        { timeout: 10_000 },
      );

      await page.goto("/superadmin");

      // URL must stay on /superadmin (in-place render, no redirect).
      await expect(page).toHaveURL(/\/superadmin/);

      // Visible 403 marker.
      await expect(page.getByText(/403 · Access denied/i)).toBeVisible();

      const main = page.getByRole("main");
      await expect(main).toHaveAttribute("data-http-status", "403");
      await expect(main).toHaveAttribute("data-area-slug", "superadmin");
      await expect(page).toHaveTitle(/Access denied — 403/);

      // Real HTTP 403 in the browser network log.
      const beacon = await beaconPromise;
      expect(beacon.status()).toBe(403);

      // The page should observe and surface the 403 it received.
      await expect(main).toHaveAttribute("data-status-beacon", "403", {
        timeout: 5_000,
      });
    });

    test("system admin: reaches Superadmin page, no Forbidden UI", async ({
      page,
    }) => {
      await seedFakeSession(page, ref!);
      await mockSystemAdminLookup(page, true);
      // Even for admins, mock these so a stray call can't pollute the
      // assertion (and so we can count beacon hits below).
      await mockForbiddenStatusBeacon(page);
      await mockAuditLogBeacon(page);
      await stubOtherRestCalls(page);

      let statusBeaconHits = 0;
      let auditBeaconHits = 0;
      page.on("request", (req) => {
        const u = req.url();
        if (u.includes("/functions/v1/forbidden-status")) statusBeaconHits++;
        if (u.includes("/functions/v1/log-forbidden-access")) auditBeaconHits++;
      });

      await page.goto("/superadmin");
      await expect(page).toHaveURL(/\/superadmin/);

      // The Forbidden marker must NOT be present.
      await expect(page.locator('[data-http-status="403"]')).toHaveCount(0);
      // Title must not flip to the denial form.
      await expect(page).not.toHaveTitle(/Access denied — 403/);

      // Give any stray beacons a beat to fire (they shouldn't).
      await page.waitForTimeout(500);
      expect(statusBeaconHits, "status beacon must not fire for admins").toBe(0);
      expect(auditBeaconHits, "audit beacon must not fire for admins").toBe(0);
    });
  });
});
