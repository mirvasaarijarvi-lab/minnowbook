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

const TOAST_SELECTOR =
  "[data-radix-toast-viewport] li, [data-sonner-toast], [data-radix-toast-viewport] li:visible, [data-sonner-toast]:visible";

/**
 * Close every notification that is currently on screen. A visible toast sits
 * in a fixed layer and can cover the submit button, so repeat clicks in this
 * spec dismiss the previous notification first, exactly as a guest would.
 *
 * Toast libraries keep a dismissed node in the DOM while its exit animation
 * runs, so this waits until no toast node is left at all before returning:
 * an animating node still intercepts pointer events over the form.
 */
async function dismissToasts(page: Page) {
  const toasts = page.locator(TOAST_SELECTOR);

  for (let pass = 0; pass < 10; pass += 1) {
    if ((await toasts.count()) === 0) return;
    const closers = page.locator(
      "[data-radix-toast-viewport] li button:visible, [data-sonner-toast] button:visible",
    );
    const count = await closers.count();
    for (let i = count - 1; i >= 0; i -= 1) {
      await closers
        .nth(i)
        .click({ force: true, timeout: 2_000 })
        .catch(() => undefined);
    }
    await page
      .waitForFunction(
        (sel) => document.querySelectorAll(sel).length === 0,
        TOAST_SELECTOR,
        { timeout: 2_000 },
      )
      .catch(() => undefined);
  }

  await expect(
    toasts,
    "all notifications should close before the next click",
  ).toHaveCount(0, { timeout: 10_000 });
}

/**
 * The guest-facing refusal wording appears twice on purpose: in the notice on
 * screen and in the assertive live region for screen readers. Scope screen
 * assertions to the notice so they stay unambiguous; the live region is
 * checked separately through `announced`.
 */
const notice = (page: Page, text: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text });

/** Click the submit button again, with the notification layer cleared. */
async function clickAgain(page: Page, button: ReturnType<Page["getByRole"]>) {
  await dismissToasts(page);
  await button.scrollIntoViewIfNeeded();
  await button.click();
}

/** Fill the change request and submit it, returning the submit button. */
async function requestNewDate(page: Page) {
  const button = page.getByRole("button", { name: "Request new date" });
  await page.locator("#reschedule-date").fill(futureDate(45));
  await expect(button).toBeEnabled();
  // Any notice still on screen would sit over the button, so clear the layer
  // first: this is the only thing that can intercept the click.
  await dismissToasts(page);
  await button.scrollIntoViewIfNeeded();
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
  // Pre-answer the cookie banner and pin the language. The banner is a fixed
  // overlay above the portal's action buttons, so leaving it open makes every
  // repeat click land on the banner instead of "Request new date".
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("mimmobook-lang", "en");
      window.localStorage.setItem(
        "cookie-consent",
        JSON.stringify({
          version: 1,
          categories: { necessary: true, analytics: false, marketing: false },
          updatedAt: new Date().toISOString(),
        }),
      );
    });
  });

  test("replaces, announces and clears refusals across retries and bookings", async ({
    page,
  }) => {
    const state = { outcome: "invoiced" as Outcome, attempts: 0 };
    await mockPortal(page, state);
    await openBooking(page, "token-a");

    // --- 1. A refused action: message on screen, announced to a reader ------
    const button = await requestNewDate(page);
    const refusal = notice(page, GUEST_INVOICED);
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
    await clickAgain(page, button);
    await expect
      .poll(() => page.locator(REGION).textContent(), { timeout: 10_000 })
      .not.toBe(firstAnnouncement);
    // Still exactly one refusal on screen, not two stacked copies.
    await expect(notice(page, GUEST_INVOICED)).toHaveCount(1);
    await expect
      .poll(() => announced(page), { timeout: 10_000 })
      .toContain("already been invoiced");
    expect(state.attempts, "both attempts reached the server").toBe(2);

    // --- 3. A different reason replaces the previous wording ---------------
    state.outcome = "cancelled-rule";
    await clickAgain(page, button);
    await expect(notice(page, GUEST_CANCELLED)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      notice(page, GUEST_INVOICED),
      "the earlier reason must be gone",
    ).toHaveCount(0);
    await expect
      .poll(() => announced(page), { timeout: 10_000 })
      .toContain("already cancelled");

    // --- 4. A successful retry clears message and announcement ------------
    state.outcome = "ok";
    await clickAgain(page, button);
    await expect(
      page.getByText("Your change request has been sent").first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(notice(page, GUEST_CANCELLED)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");

    // --- 5. Switching bookings clears a pending refusal -------------------
    state.outcome = "invoiced";
    await openBooking(page, "token-a2");
    await requestNewDate(page);
    await expect(notice(page, GUEST_INVOICED)).toBeVisible({
      timeout: 15_000,
    });

    await openBooking(page, "token-b");
    await expect(page.getByTestId("guest-portal-name")).toHaveText(
      "Second Booking Guest",
    );
    await expect(
      notice(page, GUEST_INVOICED),
      "a refusal from the previous booking must not follow the guest",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");

    // --- 6. The new booking refuses and then succeeds on its own ----------
    state.outcome = "cancelled-rule";
    const buttonB = await requestNewDate(page);
    await expect(notice(page, GUEST_CANCELLED)).toBeVisible({
      timeout: 15_000,
    });
    await expect(notice(page, GUEST_INVOICED)).toHaveCount(0);

    state.outcome = "ok";
    await clickAgain(page, buttonB);
    await expect(
      page.getByText("Your change request has been sent").first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(notice(page, GUEST_CANCELLED)).toHaveCount(0, {
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
    await expect(notice(page, GUEST_INVOICED)).toBeVisible({
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
      notice(page, GUEST_INVOICED),
      "going back must not carry the refusal to the previous booking",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");

    // Refuse here, then go forward again: still nothing stale.
    state.outcome = "cancelled-rule";
    await requestNewDate(page);
    await expect(notice(page, GUEST_CANCELLED)).toBeVisible({
      timeout: 15_000,
    });

    await page.goForward({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guest-portal-name")).toHaveText(
      "Second Booking Guest",
      {
        timeout: 30_000,
      },
    );
    await expect(notice(page, GUEST_CANCELLED)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(notice(page, GUEST_INVOICED)).toHaveCount(0);
    await expect.poll(() => announced(page), { timeout: 10_000 }).toBe("");
  });
});
