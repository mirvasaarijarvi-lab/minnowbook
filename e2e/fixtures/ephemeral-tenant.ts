/**
 * Playwright fixture: per-spec ephemeral tenant.
 *
 * Use this when a spec wants full isolation from the shared `mimmin-testi`
 * tenant (preferred for new specs). Each test gets its own tenant created in
 * `setup` and dropped in teardown, regardless of test outcome.
 *
 * Requires SERVICE_ROLE_KEY in the runner env (already set in CI workflows).
 *
 *   import { test, expect } from "../fixtures/ephemeral-tenant";
 *   test("...", async ({ ephemeralTenant, page }) => {
 *     await page.goto(`/book/${ephemeralTenant.slug}`);
 *   });
 */
import { test as base, expect } from "@playwright/test";
import {
  createEphemeralTenant,
  type EphemeralTenant,
} from "../../src/test/helpers/ephemeral-tenant";

type Fixtures = {
  ephemeralTenant: EphemeralTenant;
};

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  ephemeralTenant: async ({}, use, testInfo) => {
    const label = testInfo.title.replace(/[^a-z0-9-]/gi, "-").slice(0, 24).toLowerCase();
    const tenant = await createEphemeralTenant({ label });
    try {
      await use(tenant);
    } finally {
      await tenant.cleanup();
    }
  },
});

export { expect };
