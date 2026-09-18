import { test, expect, Page, Route } from "@playwright/test";

/**
 * End-to-end: the confirmation shown after accepting an offer must state the
 * Kitchen tab outcome, and the same outcome must reach screen readers.
 *
 * Two offers are exercised through the real dashboard UI:
 *
 *   1. An offer WITH food and drink lines — the toast and the live region must
 *      name how many lines were sent to the Kitchen tab, and the kitchen rows
 *      must actually be written.
 *   2. An offer WITHOUT any menu — the confirmation must state that a regular
 *      reservation was created and nothing was sent to the Kitchen tab, and no
 *      kitchen rows may be written.
 *
 * Driven entirely by Playwright route mocking (same approach as
 * `superadmin-mocked-auth.spec.ts`): a fake session in localStorage plus
 * mocked PostgREST responses. No secrets, no real tenant, runs on every CI
 * invocation.
 */

const FAKE_USER_ID = "00000000-0000-0000-0000-00000000f00d";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function projectRef(): string | null {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) return null;
  return url.match(/^https?:\/\/([^.]+)\./)?.[1] ?? null;
}

async function seedFakeSession(page: Page, ref: string) {
  const session = {
    access_token: "fake.jwt.token",
    refresh_token: "fake-refresh",
    token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    expires_in: 60 * 60 * 24,
    user: {
      id: FAKE_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "staff@example.com",
      app_metadata: {},
      user_metadata: {},
    },
  };
  await page.addInitScript(
    ({ key, value, lang }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem("mimmobook-lang", lang);
    },
    { key: `sb-${ref}-auth-token`, value: session, lang: "en" },
  );
}

const TENANT_ROW = {
  id: TENANT_ID,
  name: "Kitchen E2E Tenant",
  slug: "kitchen-e2e",
  tier: "professional",
  subscription_status: "active",
  allowed_reservation_types: ["venue", "restaurant"],
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const RESOURCE_ROW = {
  id: "resource-hall",
  tenant_id: TENANT_ID,
  name: "Main Hall",
  resource_type: "venue",
  is_active: true,
  price_per_night: null,
  breakfast_price_per_person: null,
  sub_services: [{ name: "Main Hall", price_eur: 450 }],
};

function offerRow(overrides: Record<string, unknown>) {
  return {
    id: "offer-e2e-1",
    tenant_id: TENANT_ID,
    status: "sent",
    validity_date: null,
    guest_name: "Kitchen E2E Guest",
    guest_email: "guest@example.com",
    guest_phone: "+358 40 1234567",
    event_date: "2099-06-01",
    start_time: "17:00",
    end_time: "23:00",
    guests_count: 20,
    event_space: "Main Hall",
    event_type: "Wedding",
    invoicing_details: null,
    special_requests: null,
    menu: null,
    linked_reservations: null,
    reservation_ids: null,
    created_by: FAKE_USER_ID,
    language: "en",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    last_sent_at: null,
    last_send_provider_id: null,
    ...overrides,
  };
}

const json = (route: Route, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "content-range": "*/*",
      "access-control-expose-headers": "content-range",
      ...headers,
    },
    body: JSON.stringify(body),
  });

/**
 * Mock every backend call the offers screen makes, and record the kitchen rows
 * the UI writes so the assertions can check them.
 */
async function mockBackend(page: Page, offer: Record<string, unknown>) {
  const kitchenRows: any[] = [];
  const reservations: any[] = [];

  // The seeded session token is fake, so the real /auth/v1/user check would
  // 401 and sign the page out mid-test. Answer it with the same user.
  await page.route(/\/auth\/v1\/user/, (route) =>
    json(route, {
      id: FAKE_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "staff@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    }),
  );

  // Subscription and other edge-function beacons are irrelevant here, and the
  // real endpoints are not reachable from the test environment.
  await page.route(/\/functions\/v1\//, (route) => json(route, { subscribed: true }));

  await page.route(/\/rest\/v1\/.*/, async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();
    const path = new URL(url).pathname.replace("/rest/v1/", "");

    if (process.env.E2E_DEBUG) console.log("[rest]", method, url);
    if (path.startsWith("rpc/is_system_admin")) return json(route, false);

    if (path.startsWith("tenant_users")) {
      // Owner role short-circuits the permission lookup, so every dashboard
      // view (including Offers) is reachable.
      return json(route, {
        user_id: FAKE_USER_ID,
        tenant_id: TENANT_ID,
        role: "owner",
        custom_role_key: null,
        tenants_safe: TENANT_ROW,
      });
    }

    if (path.startsWith("tenants_safe") || path.startsWith("tenants")) {
      return json(route, [TENANT_ROW]);
    }

    if (path.startsWith("resources")) {
      // The Kitchen nav entry is gated on a counted head request, which needs a
      // real content-range so the client sees count = 1.
      if (method === "HEAD") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "content-range": "0-0/1",
            // Cross-origin responses only expose content-range when asked, and
            // the Kitchen nav gate reads its count from that header.
            "access-control-expose-headers": "content-range",
          },
          body: "",
        });
      }
      return json(route, [RESOURCE_ROW], { "content-range": "0-0/1" });
    }

    if (path.startsWith("offers")) {
      if (method === "GET") return json(route, [offer]);
      // PATCH marks the offer confirmed.
      return json(route, [{ ...offer, status: "confirmed" }]);
    }

    if (path.startsWith("reservations")) {
      if (method === "GET") {
        // The Kitchen tab lists the reservations created from the offer.
        return json(
          route,
          reservations.map((r) => ({
            ...r,
            guest_name: r.guest_name ?? "Kitchen E2E Guest",
            status: r.status ?? "confirmed",
          })),
        );
      }
      if (method === "POST") {
        const body = request.postDataJSON();
        const row = { id: `reservation-${reservations.length + 1}`, ...body };
        reservations.push(row);
        // .single() asks for a single object, not an array.
        const wantsObject = (request.headers()["accept"] ?? "").includes("pgrst.object");
        return json(route, wantsObject ? row : [row]);
      }
      return json(route, []);
    }

    if (path.startsWith("kitchen_orders")) {
      if (method === "POST") {
        const body = request.postDataJSON();
        for (const row of Array.isArray(body) ? body : [body]) kitchenRows.push(row);
        return json(route, Array.isArray(body) ? body : [body]);
      }
      // The Kitchen tab reads back exactly the rows the offer wrote.
      return json(
        route,
        kitchenRows.map((row, index) => ({
          id: `kitchen-order-${index + 1}`,
          status: "received",
          notes: null,
          unit_price_eur: null,
          sort_order: index,
          ...row,
        })),
      );
    }

    return json(route, []);
  });

  return { kitchenRows, reservations };
}

async function openOffers(page: Page) {
  await seedFakeSession(page, ref!);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Offers", exact: true }).first().click();
  await expect(page.getByText("Kitchen E2E Guest").first()).toBeVisible({ timeout: 15_000 });
}

/** Wait for the confirmation toast and return its full text. */
async function readToast(page: Page): Promise<string> {
  const toast = page.locator("[data-sonner-toast]").first();
  await toast.waitFor({ state: "visible", timeout: 15_000 });
  return (await toast.innerText()).replace(/\s+/g, " ");
}

const ref = projectRef();

/** Today in the browser's calendar format, so the Kitchen tab shows it by default. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

test.describe("Offer confirmation states the Kitchen tab result", () => {
  test.skip(!ref, "VITE_SUPABASE_URL is required to compute the auth-token key");

  test("offer with food and drinks: confirmation names the lines sent to the kitchen", async ({
    page,
  }) => {
    const recorded = await mockBackend(
      page,
      offerRow({
        menu: ["20 x Roast beef", "4 x Vegan plate (no nuts)", "20 x Red wine"].join("\n"),
      }),
    );

    await openOffers(page);
    await page.getByRole("button", { name: "Confirm", exact: true }).first().click();

    // Toast: headline plus the kitchen count.
    // Toasts auto-dismiss, so capture the text once and assert on the snapshot.
    const toastText = await readToast(page);
    expect(toastText).toContain("Offer confirmed");
    expect(toastText).toContain(
      "3 food and drink lines from the offer were sent to the Kitchen tab.",
    );

    // Screen-reader announcement carries the same outcome.
    const region = page.locator("#offer-status-live-region");
    await expect(region).toHaveAttribute("aria-live", "polite");
    await expect(region).toHaveAttribute("role", "status");
    await expect(region).toHaveAttribute("aria-atomic", "true");
    await expect(region).toContainText("Offer confirmed");
    await expect(region).toContainText("3 food and drink lines");

    // The lines really were written for the Kitchen tab.
    await expect
      .poll(() => recorded.kitchenRows.length, { timeout: 10_000 })
      .toBe(3);
    expect(recorded.kitchenRows.map((r) => [r.item_name, r.quantity, r.category])).toEqual([
      ["Roast beef", 20, "food"],
      ["Vegan plate", 4, "food"],
      ["Red wine", 20, "drink"],
    ]);
    expect(recorded.reservations).toHaveLength(1);
  });

  test("offer without food or drinks: confirmation says nothing was sent to the kitchen", async ({
    page,
  }) => {
    const recorded = await mockBackend(page, offerRow({ id: "offer-e2e-2", menu: "   \n \n" }));

    await openOffers(page);
    await page.getByRole("button", { name: "Confirm", exact: true }).first().click();

    const toastText = await readToast(page);
    expect(toastText).toContain("Offer confirmed");
    expect(toastText).toContain(
      "This offer had no food or drinks, so a regular reservation was created and nothing was sent to the Kitchen tab.",
    );

    const region = page.locator("#offer-status-live-region");
    await expect(region).toContainText("nothing was sent to the Kitchen tab");

    // One plain reservation, no kitchen lines at all.
    await expect.poll(() => recorded.reservations.length, { timeout: 10_000 }).toBe(1);
    expect(recorded.kitchenRows).toHaveLength(0);
  });

  test("accepted offer's food and drink lines show up in the Kitchen tab", async ({ page }) => {
    // The event is today so the Kitchen tab, which opens on today, lists it.
    const recorded = await mockBackend(
      page,
      offerRow({
        id: "offer-e2e-3",
        event_date: todayIso(),
        menu: [
          "20 x Roast beef - medium rare",
          "4 x Vegan plate (no nuts)",
          "20 x Red wine",
        ].join("\n"),
      }),
    );

    await openOffers(page);
    await page.getByRole("button", { name: "Confirm", exact: true }).first().click();

    // Wait until the kitchen lines have been written by the confirmation.
    await expect.poll(() => recorded.kitchenRows.length, { timeout: 15_000 }).toBe(3);

    // Now open the Kitchen tab and check the guest and the lines are listed.
    await page.getByRole("button", { name: "Kitchen", exact: true }).first().click();
    await expect(page.getByText("Kitchen E2E Guest").first()).toBeVisible({ timeout: 15_000 });

    const itemNames = page.getByRole("textbox", { name: "Item" });
    await expect(itemNames).toHaveCount(3);
    await expect(itemNames.nth(0)).toHaveValue("Roast beef");
    await expect(itemNames.nth(1)).toHaveValue("Vegan plate");
    await expect(itemNames.nth(2)).toHaveValue("Red wine");

    const quantities = page.getByRole("spinbutton", { name: "Qty" });
    await expect(quantities.nth(0)).toHaveValue("20");
    await expect(quantities.nth(1)).toHaveValue("4");
    await expect(quantities.nth(2)).toHaveValue("20");

    // The note written after the dash / in brackets travelled with the line.
    const notes = page.getByRole("textbox", { name: "Notes" });
    await expect(notes.nth(0)).toHaveValue("medium rare");
    await expect(notes.nth(1)).toHaveValue("no nuts");

    // Category comes through as food / drink.
    await expect(page.getByRole("combobox", { name: "Category" }).nth(2)).toContainText("Drink");
  });
});
