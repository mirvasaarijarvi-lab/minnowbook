import { test, expect } from "@playwright/test";

/**
 * End-to-end cross-booking test.
 *
 * Same guest books across multiple resources/services in a single flow:
 *   1. Restaurant reservation
 *   2. Guesthouse (overnight) reservation
 *   3. Venue reservation
 *
 * Each call goes through the real `public-booking` edge function and creates
 * a real reservation row in the connected backend. Guest name is prefixed
 * with `TEST Lovable` so rows can be cleaned up after the run.
 *
 * Run locally:
 *   bunx playwright test e2e/cross-booking-same-guest.spec.ts
 *
 * Tenant used: `mimmin-testi` (multi-site test tenant).
 */

const SUPABASE_URL = "https://lsgznskkxadplwnxplhd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzZ3puc2treGFkcGx3bnhwbGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MTkyODAsImV4cCI6MjA4NzQ5NTI4MH0.v6DlzrUsFu_fpTIcWcSzz1Zyqbl_ZwF9v54TrW_yWtM";

const TENANT_SLUG = "mimmin-testi";
const TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";

// Real, active resources in `mimmin-testi`
const RESOURCES = {
  restaurant: "63137f6d-4da6-4128-b43b-0901771f2137", // Another restaurant (no site)
  guesthouse: "741ae83b-e626-4def-a6c0-27377de3ff28", // Single Room 1
  venue: "3c5f9fc2-39f7-4e07-b45e-972e6afc9427", // Eventos Mimmilitos
};

// Shared guest profile used across every booking in this flow
const GUEST = {
  guest_name: `TEST Lovable Cross ${Date.now()}`,
  guest_email: `test-cross-${Date.now()}@example.com`,
  guest_phone: "+358 40 0000000",
};

// Far-future date so we never collide with real bookings or block windows
function futureDate(offsetDays = 60): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Per-call HTTP timeout. Edge functions can cold-start (~1.5s typical, up to ~5s)
// so we give each call a generous explicit budget instead of relying on defaults.
const PUBLIC_BOOKING_TIMEOUT_MS = 30_000;
// One transparent retry on transient network errors (cold start, dropped connection)
const PUBLIC_BOOKING_MAX_ATTEMPTS = 2;

async function callPublicBooking(
  request: import("@playwright/test").APIRequestContext,
  body: Record<string, unknown>,
  label: string,
) {
  const url = `${SUPABASE_URL}/functions/v1/public-booking`;
  const requestHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };

  let lastError: unknown = null;
  let res: import("@playwright/test").APIResponse | null = null;
  let durationMs = 0;
  for (let attempt = 1; attempt <= PUBLIC_BOOKING_MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      res = await request.post(url, {
        headers: requestHeaders,
        data: body,
        timeout: PUBLIC_BOOKING_TIMEOUT_MS,
      });
      durationMs = Date.now() - startedAt;
      break;
    } catch (err) {
      durationMs = Date.now() - startedAt;
      lastError = err;
      // eslint-disable-next-line no-console
      console.warn(
        `[cross-booking] ${label} attempt ${attempt}/${PUBLIC_BOOKING_MAX_ATTEMPTS} threw after ${durationMs}ms: ${(err as Error)?.message ?? err}`,
      );
      if (attempt === PUBLIC_BOOKING_MAX_ATTEMPTS) throw err;
      // Brief backoff before the retry to let any cold-start finish
      await new Promise((r) => setTimeout(r, 750));
    }
  }
  if (!res) throw lastError ?? new Error(`public-booking ${label} produced no response`);

  const durationMs = Date.now() - startedAt;
  const status = res.status();
  const responseHeaders = res.headers();
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leave as text */
  }

  const diagnostic = {
    label,
    request: {
      method: "POST",
      url,
      // Redact bearer tokens; keep payload for debugging
      headers: { ...requestHeaders, Authorization: "Bearer <redacted>", apikey: "<redacted>" },
      body,
    },
    response: { status, durationMs, headers: responseHeaders, body: json ?? text },
  };

  if (status >= 400) {
    // eslint-disable-next-line no-console
    console.error(
      `\n[cross-booking] ${label} FAILED (HTTP ${status}, ${durationMs}ms)\n` +
        JSON.stringify(diagnostic, null, 2) +
        "\n",
    );
    try {
      // Attach to the Playwright HTML report so each retry has its own artifact
      await test.info().attach(`public-booking-${label}-failure.json`, {
        body: Buffer.from(JSON.stringify(diagnostic, null, 2), "utf-8"),
        contentType: "application/json",
      });
    } catch {
      /* test.info() unavailable outside test scope */
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`[cross-booking] ${label} OK (HTTP ${status}, ${durationMs}ms)`);
  }

  return { status, body: json ?? text, diagnostic };
}

test.describe("Cross-booking: same guest, multiple resources/services", () => {
  test("public booking page for the test tenant loads", async ({ page }) => {
    // Wait for the SPA shell + initial XHRs to settle, not just DOMContentLoaded.
    const response = await page.goto(`/book/${TENANT_SLUG}`, { waitUntil: "networkidle" });
    expect(response, "navigation produced no response").not.toBeNull();
    expect(response!.status(), `unexpected HTTP status for /book/${TENANT_SLUG}`).toBeLessThan(400);

    // Hard-fail fast if the SPA rendered the not-found view
    await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);

    // Wait for the booking shell to actually be visible. The public booking
    // page always renders a <main> region once the tenant has loaded.
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

    // And the not-found copy must not appear anywhere on the page
    await expect(page.locator("body")).not.toContainText(/not found|404/i, { timeout: 5_000 });
  });

  test("creates restaurant + guesthouse + venue reservations for the same guest", async ({ request }) => {
    const date = futureDate(60);
    const checkOut = futureDate(62);

    // Warm the edge function so the first real leg doesn't pay the cold-start penalty
    // (and so any platform 5xx during cold-start surfaces as a clear, single failure here).
    await request
      .post(`${SUPABASE_URL}/functions/v1/public-booking`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        data: { warmup: true },
        timeout: PUBLIC_BOOKING_TIMEOUT_MS,
      })
      .catch(() => {
        /* warmup is best-effort; ignore */
      });

    // 1. Restaurant
    const restaurant = await callPublicBooking(
      request,
      {
        tenant_id: TENANT_ID,
        ...GUEST,
        guests_count: 2,
        reservation_type: "restaurant",
        resource_id: RESOURCES.restaurant,
        date,
        start_time: "19:00",
        special_requests: "TEST: cross-booking restaurant leg",
      },
      "restaurant",
    );
    expect(
      restaurant.status,
      `restaurant booking failed: ${JSON.stringify(restaurant.diagnostic, null, 2)}`,
    ).toBeLessThan(400);

    // 2. Guesthouse (overnight)
    const guesthouse = await callPublicBooking(
      request,
      {
        tenant_id: TENANT_ID,
        ...GUEST,
        guests_count: 2,
        reservation_type: "guesthouse",
        resource_id: RESOURCES.guesthouse,
        date,
        check_out_date: checkOut,
        special_requests: "TEST: cross-booking guesthouse leg",
      },
      "guesthouse",
    );
    expect(
      guesthouse.status,
      `guesthouse booking failed: ${JSON.stringify(guesthouse.diagnostic, null, 2)}`,
    ).toBeLessThan(400);

    // 3. Venue
    const venue = await callPublicBooking(
      request,
      {
        tenant_id: TENANT_ID,
        ...GUEST,
        guests_count: 30,
        reservation_type: "venue",
        resource_id: RESOURCES.venue,
        date,
        start_time: "12:00",
        event_type: "corporate",
        special_requests: "TEST: cross-booking venue leg",
      },
      "venue",
    );
    expect(
      venue.status,
      `venue booking failed: ${JSON.stringify(venue.diagnostic, null, 2)}`,
    ).toBeLessThan(400);

    // Surface guest identifier so cleanup is easy after the run
    console.log(`[cross-booking] created reservations for guest "${GUEST.guest_name}" (${GUEST.guest_email})`);
  });
});
