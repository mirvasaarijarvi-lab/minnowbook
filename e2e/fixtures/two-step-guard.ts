/**
 * Offer tests sign in with a staff test login that must NOT use two-step
 * sign-in. If it does, the app shows the six-digit code screen and the test
 * would otherwise hang until a generic timeout. These helpers fail at once
 * with a message explaining what to fix.
 */
import { expect, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TWO_STEP_FAILURE =
  "The staff test login asks for a two-step code, so offer tests cannot run. " +
  "Turn off two-step sign-in for this login (or use a login without it); " +
  "see docs/ci/e2e-staff-secrets.md.";

/** After signing in through the API: fail if the login still needs a code. */
export async function assertNoTwoStepRequired(client: SupabaseClient, label = "staff test login") {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(`Could not check two-step sign-in for ${label}: ${error.message}`);
  if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
    throw new Error(`${TWO_STEP_FAILURE} (${label})`);
  }
}

/** After opening an app page: fail if the two-step code screen is showing. */
export async function expectNoTwoStepScreen(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  const screen = page.getByRole("heading", {
    name: /^(Two-Factor Authentication|Use Recovery Code)$/,
  });
  await expect(screen, TWO_STEP_FAILURE).toHaveCount(0);
}
