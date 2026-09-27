/**
 * The dashboard opens a first-visit guided tour whose full-screen overlay
 * intercepts every click (e.g. the Offers button in the sidebar). E2E runs
 * start with empty browser storage, so mark the tour as seen up front.
 *
 * Key must match TOUR_STORAGE_KEY in src/pages/Dashboard.tsx.
 */
import type { BrowserContext } from "@playwright/test";

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
