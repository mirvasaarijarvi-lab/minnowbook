/**
 * The dashboard opens a first-visit guided tour whose full-screen overlay
 * intercepts every click (e.g. the Offers button in the sidebar). E2E runs
 * start with empty browser storage, so mark the tour as seen up front.
 *
 * Key must match TOUR_STORAGE_KEY in src/pages/Dashboard.tsx.
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { expectNoTwoStepScreen } from "./two-step-guard";

/**
 * Call after opening the dashboard, before clicking offer actions: fails
 * clearly if the two-step code screen is showing, the tour was not marked
 * as seen, or its overlay is on screen.
 */
export async function expectWelcomeTourDismissed(page: Page) {
  await expectNoTwoStepScreen(page);
  const seen = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    WELCOME_TOUR_KEY,
  );
  expect(seen, "welcome tour should be marked as seen").toBe("true");
  await expect(
    page.getByRole("button", { name: "Close tour" }),
    "welcome tour overlay should not be showing",
  ).toHaveCount(0);
  await expect(page.locator("div.fixed.inset-0.z-\\[9999\\]")).toHaveCount(0);
}

export const WELCOME_TOUR_KEY = "mimmobook-tour-completed";

/** storageState for the app origin with the welcome tour already seen. */
export function welcomeTourSeenStorageState(baseURL: string) {
  return {
    cookies: [],
    origins: [
      {
        origin: new URL(baseURL).origin,
        localStorage: [{ name: WELCOME_TOUR_KEY, value: "true" }],
      },
    ],
  };
}

/** For contexts made by hand with browser.newContext(). Runs before app code. */
export async function markWelcomeTourSeen(context: BrowserContext) {
  await context.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, "true");
    } catch {
      /* storage unavailable on about:blank */
    }
  }, WELCOME_TOUR_KEY);
}
