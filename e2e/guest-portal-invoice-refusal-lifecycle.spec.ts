import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * End-to-end: the lifecycle of an invoicing refusal in the browser.
 *
 * The guest portal is the one invoicing surface reachable without a login, so
 * it is where the refusal notice can be exercised as a real user does, with a
 * real toast, a real live region and real React re-renders. Everything the
 * page talks to is one edge function, which this spec mocks, so no secrets,
 * no seeded bookings and no deployed function are needed: it runs on every CI
 * invocation.
 *
 * What is verified, in order:
 *
 *   1. A refused action shows the guest wording, and announces it in the
 *      dedicated assertive live region.
 *   2. A retry that fails the same way replaces the message instead of
 *      stacking a second copy, and re-announces it (the announced text must
 *      change, otherwise a screen reader stays silent on the retry).
 *   3. A refusal with a different reason replaces the previous wording, so no
 *      sentence from the earlier attempt is left on screen.
 *   4. A successful retry clears both the message and the announcement.
 *   5. Switching to another reservation (a different booking link) clears a
 *      pending refusal, so it can never sit next to a booking it is not about.
 *   6. The second booking can be refused and then succeed on its own, with no
 *      trace of the first booking's refusal at any point.
 */

const REGION = "#invoice-refusal-live-region";

const GUEST_INVOICED =
  "This booking has already been invoiced, so it can no longer be changed here. Please contact us directly.";
const GUEST_CANCELLED =
  "This booking is already cancelled, so there is nothing left to change.";
const STAFF_ONLY_WORDING =
  "Add a price before marking this reservation as invoiced";

/** Server replies the mocked edge function can be told to produce. */
type Outcome = "invoiced" | "cancelled-rule" | "ok";

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Mock the guest portal edge function. `state.outcome` decides how the next
 * reschedule attempt is answered, so the spec can flip between refusals and
 * success between clicks.
 */
async function mockPortal(
  page: Page,
  state: { outcome: Outcome; attempts: number },
) {
  await page.route(
    "**/functions/v1/guest-booking-portal",
    async (route: Route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS, body: "" });
        return;
      }
      const body = route.request().postDataJSON() as {
        action?: string;
        token?: string;
      };
      const token = body?.token ?? "unknown";

      if (body?.action === "view") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: CORS,
          body: JSON.stringify({
            ok: true,
            reservation: {
              id: `res-${token}`,
              guest_name:
                token === "token-b"
                  ? "Second Booking Guest"
                  : "First Booking Guest",
              reservation_type: "restaurant",
              status: "confirmed",
              date: futureDate(30),
              start_time: "18:00",
              guests_count: 2,
              price_eur: 120,
            },
            token: { token },
            settings: {},
          }),
        });
        return;
      }

      state.attempts += 1;
      if (state.outcome === "ok") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: CORS,
          body: JSON.stringify({ ok: true }),
        });
        return;
      }
      // Refusals arrive as a 200 body carrying `error`, which is how the real
      // function reports a rule it will not break.
      const error =
        state.outcome === "invoiced"
          ? "This reservation is already invoiced and cannot be changed after invoicing."
          : "This reservation is cancelled, so invoicing no longer applies.";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({ ok: false, error }),
      });
    },
  );
}

async function openBooking(page: Page, token: string) {
  await page.goto(`/my-booking/${token}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("guest-portal-name")).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Close any notification that is currently on screen. A visible toast sits in
 * a fixed layer and can cover the submit button, so repeat clicks in this spec
 * dismiss the previous notification first, exactly as a guest would.
 */
async function dismissToasts(page: Page) {
  const visibleToasts = page.locator(
    "[data-radix-toast-viewport] li:visible, [data-sonner-toast]:visible",
  );

  // Sonner keeps dismissed toast nodes in the DOM while their exit animation
  // runs. Selecting the first unfiltered close button can therefore keep
  // finding an already hidden, removed toast and leave the visible toast over
  // the form. Always target a close control inside a currently visible toast.
  for (let pass = 0; pass < 3; pass += 1) {
    const toast = visibleToasts.first();
    if (!(await toast.isVisible().catch(() => false))) return;
    const closer = toast
      .locator("button[data-close-button]:visible, button:visible")
      .first();
    await expect(closer, "visible notifications need a close control").toBeVisible();
    await closer.click({ force: true });
    await toast.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
    if ((await visibleToasts.count()) === 0) return;
  }

  await expect(visibleToasts, "all visible notifications should close").toHaveCount(
    0,
    { timeout: 8_000 },
  );
}

/** Fill the change request and submit it, returning the submit button. */
async function requestNewDate(page: Page) {
  const button = page.getByRole("button", { name: "Request new date" });
  await page.locator("#reschedule-date").fill(futureDate(45));
  await expect(button).toBeEnabled();
  await button.click();
  return button;
}

/**
 * Text currently in the live region, or "" when the region does not exist
 * (which is the case right after a full page load).
 */
const announced = (page: Page) =>
  page.evaluate(
    (sel) => (document.querySelector(sel)?.textContent ?? "").trim(),
    REGION,
  );

test.describe("Invoice refusal notice lifecycle", () => {
  test("replaces, announces and clears refusals across retries and bookings", async ({
    page,
  }) => {
    const state = { outcome: "invoiced" as Outcome, attempts: 0 };
    await mockPortal(page, state);
    await openBooking(page, "token-a");

    // --- 1. A refused action: message on screen, announced to a reader ------
    const button = await requestNewDate(page);
    const refusal = page.getByText(GUEST_INVOICED);
    await expect(refusal).toBeVisible({ timeout: 15_000 });
    // Guests never see the internal, staff-only instruction.
    await expect(page.getByText(STAFF_ONLY_WORDING)).toHaveCount(0);

    const region = page.locator(REGION);
    await expect(region).toHaveCount(1);
    expect(await region.getAttribute("aria-live")).toBe("assertive");
    expect(await region.getAttribute("role")).toBe("alert");
    expect(await region.getAttribute("aria-atomic")).toBe("true");
    await expect
      .poll(() => announced(page), { timeout: 10_000 })
      .toContain("already been invoiced");

    // Focus stays usable: the retry control is still reachable.
    await expect(button).toBeEnabled();

    // --- 2. A retry that fails the same way --------------------------------
    const firstAnnouncement = await page.locator(REGION).textContent();
    await dismissToasts(page);
    await button.click();
    await expect
      .poll(() => page.locator(REGION).textContent(), { timeout: 10_000 })
      .not.toBe(firstAnnouncement);
    // Still exactly one refusal on screen, not two stacked copies.
    await expect(page.getByText(GUEST_INVOICED)).toHaveCount(1);
    await expect
      .poll(() => announced(page), { timeout: 10_000 })
      .toContain("already been invoiced");
    expect(state.attempts, "both attempts reached the server").toBe(2);

    // --- 3. A different reason replaces the previous wording ---------------
    state.outcome = "cancelled-rule";
    await dismissToasts(page);
    await button.click();
    await expect(page.getByText(GUEST_CANCELLED)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(GUEST_INVOICED),
      "the earlier reason must be gone",
    ).toHaveCount(0);
    await expect
      .poll(() => announced(page), { timeout: 10_000 })
      .toContain("already cancelled");

    // --- 4. A successful retry clears message and announcement ------------
    state.outcome = "ok";
    await dismissToasts(page);
    await button.click();
    await expect(
      page.getByText("Your change request has been sent"),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(GUEST_CANCELLED)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");

    // --- 5. Switching bookings clears a pending refusal -------------------
    state.outcome = "invoiced";
    await openBooking(page, "token-a2");
    await requestNewDate(page);
    await expect(page.getByText(GUEST_INVOICED)).toBeVisible({
      timeout: 15_000,
    });

    await openBooking(page, "token-b");
    await expect(page.getByTestId("guest-portal-name")).toHaveText(
      "Second Booking Guest",
    );
    await expect(
      page.getByText(GUEST_INVOICED),
      "a refusal from the previous booking must not follow the guest",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");

    // --- 6. The new booking refuses and then succeeds on its own ----------
    state.outcome = "cancelled-rule";
    const buttonB = await requestNewDate(page);
    await expect(page.getByText(GUEST_CANCELLED)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(GUEST_INVOICED)).toHaveCount(0);

    state.outcome = "ok";
    await dismissToasts(page);
    await buttonB.click();
    await expect(
      page.getByText("Your change request has been sent"),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(GUEST_CANCELLED)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");
  });

  test("clears a refusal on back and forward navigation between bookings", async ({
    page,
  }) => {
    const state = { outcome: "invoiced" as Outcome, attempts: 0 };
    await mockPortal(page, state);

    // Visit two bookings so the browser has history to walk through.
    await openBooking(page, "token-a");
    await openBooking(page, "token-b");
    await requestNewDate(page);
    await expect(page.getByText(GUEST_INVOICED)).toBeVisible({
      timeout: 15_000,
    });

    // Back to the first booking: the refusal belongs to the other one.
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guest-portal-name")).toHaveText(
      "First Booking Guest",
      {
        timeout: 30_000,
      },
    );
    await expect(
      page.getByText(GUEST_INVOICED),
      "going back must not carry the refusal to the previous booking",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");

    // Refuse here, then go forward again: still nothing stale.
    state.outcome = "cancelled-rule";
    await requestNewDate(page);
    await expect(page.getByText(GUEST_CANCELLED)).toBeVisible({
      timeout: 15_000,
    });

    await page.goForward({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guest-portal-name")).toHaveText(
      "Second Booking Guest",
      {
        timeout: 30_000,
      },
    );
    await expect(page.getByText(GUEST_CANCELLED)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByText(GUEST_INVOICED)).toHaveCount(0);
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");
  });
});
