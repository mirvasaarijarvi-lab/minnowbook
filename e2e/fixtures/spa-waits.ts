/**
 * Reusable browser-side wait helpers for SPA pages.
 *
 * The Lovable preview / Vite dev server can be slow to first-render
 * (cold compile, network-bound module fetches). These helpers encapsulate
 * the timing logic so every spec gets the same sandbox-tolerant behavior
 * without duplicating timeouts/selectors.
 */

import { expect, type Page } from "@playwright/test";

export interface SpaLoadOptions {
  /** Total navigation timeout (page.goto). Default 30s. */
  navTimeoutMs?: number;
  /** Per-element / per-assertion timeout. Default 20s. */
  elementTimeoutMs?: number;
  /** CSS selector that must hydrate (have child elements). Default `#root`. */
  rootSelector?: string;
  /** CSS selector that must become visible. Default `main`. */
  shellSelector?: string;
  /**
   * Regex that must NOT appear inside the shell selector. Default matches
   * common 404 / not-found copy. Set to `null` to skip the check.
   */
  notFoundPattern?: RegExp | null;
}

/**
 * Navigate to `url` and wait for the SPA to fully hydrate.
 *
 * Steps:
 *   1. `page.goto(url, { waitUntil: "domcontentloaded" })` — `networkidle`
 *      cannot resolve on pages that keep realtime/analytics XHRs open.
 *   2. Assert HTTP status < 400.
 *   3. Wait for the React root to actually render children.
 *   4. Assert there is no `<h1>404</h1>` heading.
 *   5. Assert the shell selector becomes visible.
 *   6. Assert no not-found copy inside the shell.
 *
 * Returns the navigation response so callers can inspect status/headers.
 */
export async function gotoAndWaitForSpa(
  page: Page,
  url: string,
  options: SpaLoadOptions = {},
) {
  const navTimeoutMs = options.navTimeoutMs ?? 30_000;
  const elementTimeoutMs = options.elementTimeoutMs ?? 20_000;
  const rootSelector = options.rootSelector ?? "#root";
  const shellSelector = options.shellSelector ?? "main";
  const notFoundPattern =
    options.notFoundPattern === undefined
      ? /not found|404/i
      : options.notFoundPattern;

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: navTimeoutMs,
  });
  expect(response, `navigation to ${url} produced no response`).not.toBeNull();
  expect(
    response!.status(),
    `unexpected HTTP status for ${url}`,
  ).toBeLessThan(400);

  await page.waitForFunction(
    (sel) => {
      const root = document.querySelector(sel);
      return !!root && (root as Element).childElementCount > 0;
    },
    rootSelector,
    { timeout: elementTimeoutMs },
  );

  await expect(
    page.getByRole("heading", { name: "404" }),
    `${url} rendered the 404 view instead of the SPA shell`,
  ).toHaveCount(0, { timeout: elementTimeoutMs });

  await expect(
    page.locator(shellSelector),
    `SPA shell (${shellSelector}) never became visible at ${url}`,
  ).toBeVisible({ timeout: elementTimeoutMs });

  if (notFoundPattern) {
    await expect(
      page.locator(shellSelector),
      `SPA shell (${shellSelector}) rendered not-found copy at ${url}`,
    ).not.toContainText(notFoundPattern, { timeout: elementTimeoutMs });
  }

  return response;
}
