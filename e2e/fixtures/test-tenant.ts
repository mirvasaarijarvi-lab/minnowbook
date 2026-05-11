/**
 * Shared Playwright fixtures for the `mimmin-testi` test tenant.
 *
 * Every booking-related spec (public booking, cross-booking, offer-confirm,
 * linked reservations, etc.) MUST source tenant_id, slug, and resource ids
 * from this module so the guest, resources, offers, and reservations stay
 * aligned and pass RLS checks under the same tenant_id.
 *
 * If a different tenant ever needs to be used, override via env vars:
 *   E2E_TENANT_SLUG, E2E_TENANT_ID,
 *   E2E_RESOURCE_RESTAURANT, E2E_RESOURCE_GUESTHOUSE, E2E_RESOURCE_VENUE
 */

import { test as base, expect } from "@playwright/test";

// --- Backend (publishable) ---------------------------------------------------
export const SUPABASE_URL = "https://lsgznskkxadplwnxplhd.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzZ3puc2treGFkcGx3bnhwbGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MTkyODAsImV4cCI6MjA4NzQ5NTI4MH0.v6DlzrUsFu_fpTIcWcSzz1Zyqbl_ZwF9v54TrW_yWtM";

// --- Tenant identity ---------------------------------------------------------
export const TEST_TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? "mimmin-testi";
export const TEST_TENANT_ID =
  process.env.E2E_TENANT_ID ?? "9ac05fbf-0834-44fd-a52a-d030b7074a30";

// --- Resources known to belong to TEST_TENANT_ID ----------------------------
// All resources MUST be tenant_id = TEST_TENANT_ID so reservations created
// against them satisfy public-booking validation and the per-table RLS policies.
export const TEST_RESOURCES = {
  restaurant:
    process.env.E2E_RESOURCE_RESTAURANT ?? "63137f6d-4da6-4128-b43b-0901771f2137",
  guesthouse:
    process.env.E2E_RESOURCE_GUESTHOUSE ?? "741ae83b-e626-4def-a6c0-27377de3ff28",
  venue:
    process.env.E2E_RESOURCE_VENUE ?? "3c5f9fc2-39f7-4e07-b45e-972e6afc9427",
} as const;

export type TestTenant = {
  slug: string;
  id: string;
  resources: typeof TEST_RESOURCES;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export const TEST_TENANT: TestTenant = {
  slug: TEST_TENANT_SLUG,
  id: TEST_TENANT_ID,
  resources: TEST_RESOURCES,
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
};

// --- Helpers ----------------------------------------------------------------
/** Build a shared guest profile for a single test run. */
export function makeTestGuest(label: string) {
  const stamp = Date.now();
  return {
    guest_name: `TEST Lovable ${label} ${stamp}`,
    guest_email: `test-${label.toLowerCase()}-${stamp}@example.com`,
    guest_phone: "+358 40 0000000",
  };
}

/** UTC date `offsetDays` from today as `YYYY-MM-DD`. */
export function futureDate(offsetDays = 60): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// --- Playwright fixture -----------------------------------------------------
type Fixtures = {
  tenant: TestTenant;
  /**
   * Auto-attached per-test capture of browser console messages and uncaught
   * page errors. On failure, both streams are dumped into the HTML report
   * as text attachments so timing/UI regressions can be triaged without
   * re-running the spec locally.
   */
  consoleCapture: void;
};

/**
 * Use `import { test, expect } from "../fixtures/test-tenant"` in specs to
 * get a `tenant` fixture wired to the same shared tenant_id everywhere.
 */
/* eslint-disable react-hooks/rules-of-hooks
   -- The `use`/`useFixture` parameter below is Playwright's fixture
   callback, not React's `use` hook. Disabled file-wide as a belt-and-
   suspenders alongside the e2e/** override in eslint.config.js. */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  tenant: async ({}, use) => {
    await use(TEST_TENANT);
  },
  consoleCapture: [
    async ({ page }, use, testInfo) => {
      const consoleLines: string[] = [];
      const errorLines: string[] = [];

      const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
        const loc = msg.location();
        const where = loc.url
          ? ` (${loc.url}:${loc.lineNumber}:${loc.columnNumber})`
          : "";
        consoleLines.push(
          `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}${where}`,
        );
      };
      const onPageError = (err: Error) => {
        errorLines.push(
          `[${new Date().toISOString()}] ${err.name}: ${err.message}\n${err.stack ?? ""}`,
        );
      };
      const onRequestFailed = (
        req: import("@playwright/test").Request,
      ) => {
        errorLines.push(
          `[${new Date().toISOString()}] requestfailed ${req.method()} ${req.url()} -- ${req.failure()?.errorText ?? "unknown"}`,
        );
      };

      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);

      await use();

      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);

      const failed =
        testInfo.status !== undefined &&
        testInfo.status !== testInfo.expectedStatus;
      if (failed) {
        await testInfo.attach("browser-console.log", {
          body: consoleLines.join("\n") || "(no console output)",
          contentType: "text/plain",
        });
        await testInfo.attach("page-errors.log", {
          body: errorLines.join("\n") || "(no page errors)",
          contentType: "text/plain",
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
