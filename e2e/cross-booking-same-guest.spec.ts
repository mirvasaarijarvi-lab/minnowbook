import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
  makeTestGuest,
} from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";

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
 * Tenant identity, resource ids, and the SUPABASE_* constants come from the
 * shared `test-tenant` fixture so this spec stays aligned with every other
 * booking-related spec under the same tenant_id.
 */

// Shared guest profile used across every booking in this flow
const GUEST = makeTestGuest("Cross");

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
  test("public booking page for the test tenant loads", async ({ page, tenant }) => {
    // Wait for the SPA shell + initial XHRs to settle, not just DOMContentLoaded.
    const response = await page.goto(`/book/${tenant.slug}`, { waitUntil: "networkidle" });
    expect(response, "navigation produced no response").not.toBeNull();
    expect(response!.status(), `unexpected HTTP status for /book/${tenant.slug}`).toBeLessThan(400);

    // Hard-fail fast if the SPA rendered the not-found view
    await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);

    // Wait for the booking shell to actually be visible. The public booking
    // page always renders a <main> region once the tenant has loaded.
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

    // And the not-found copy must not appear anywhere on the page
    await expect(page.locator("body")).not.toContainText(/not found|404/i, { timeout: 5_000 });
  });

  test("creates restaurant + guesthouse + venue reservations for the same guest", async ({ playwright, tenant }, testInfo) => {
    const date = futureDate(60);
    const checkOut = futureDate(62);

    // Record EVERY public-booking HTTP call into a HAR file so failures can
    // be replayed in a browser (Chrome DevTools "Import HAR file") or with
    // `npx playwright show-trace`. Saved per-attempt so retries don't clobber.
    const path = await import("node:path");
    const harDir = path.resolve(testInfo.outputDir, "har");
    const harPath = path.join(harDir, `public-booking-attempt-${testInfo.retry + 1}.har`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = await import("node:fs");
    fs.mkdirSync(harDir, { recursive: true });
    // eslint-disable-next-line no-console
    console.log(`[cross-booking] HAR will be written to ${harPath}`);

    const request = await playwright.request.newContext({
      recordHar: {
        path: harPath,
        mode: "full",
        content: "embed",
        // Match every public-booking edge function call (warmup + 3 legs +
        // negative-tenant probe). RegExp avoids glob ambiguity across
        // Playwright versions.
        urlFilter: /\/functions\/v1\/public-booking/,
      },
    });

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

    try {
    // 1. Restaurant
    const restaurant = await callPublicBooking(
      request,
      {
        tenant_id: tenant.id,
        ...GUEST,
        guests_count: 2,
        reservation_type: "restaurant",
        resource_id: tenant.resources.restaurant,
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
    expect(restaurant.body, "restaurant response shape").toMatchObject({ success: true });
    expect(restaurant.body?.capacity, "restaurant capacity payload").toBeTruthy();

    // 2. Guesthouse (overnight)
    const guesthouse = await callPublicBooking(
      request,
      {
        tenant_id: tenant.id,
        ...GUEST,
        guests_count: 2,
        reservation_type: "guesthouse",
        resource_id: tenant.resources.guesthouse,
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
    expect(guesthouse.body, "guesthouse response shape").toMatchObject({ success: true });

    // 3. Venue
    const venue = await callPublicBooking(
      request,
      {
        tenant_id: tenant.id,
        ...GUEST,
        guests_count: 30,
        reservation_type: "venue",
        resource_id: tenant.resources.venue,
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
    expect(venue.body, "venue response shape").toMatchObject({ success: true });

    // 4. Negative check: edge function MUST reject an unknown tenant_id.
    // Confirms tenant_id is actually validated server-side instead of being
    // silently ignored, which would otherwise mask cross-tenant leaks.
    const FAKE_TENANT_ID = "00000000-0000-0000-0000-000000000000";
    const rejected = await callPublicBooking(
      request,
      {
        tenant_id: FAKE_TENANT_ID,
        ...GUEST,
        guests_count: 2,
        reservation_type: "restaurant",
        resource_id: tenant.resources.restaurant,
        date,
        start_time: "19:30",
        special_requests: "TEST: cross-booking foreign-tenant negative",
      },
      "foreign-tenant-negative",
    );
    expect(
      rejected.status,
      `foreign tenant_id should be rejected by public-booking but got HTTP ${rejected.status}`,
    ).toBeGreaterThanOrEqual(400);

    // 5. RLS / tenant-isolation verification (best-effort).
    // When a service-role key is provided, query reservations directly and
    // assert every row this test created is bound to the active tenant_id
    // (mimmin-testi) and that NO row leaked into any other tenant.
    const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const admin = createClient(SUPABASE_URL, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: rows, error: queryErr } = await admin
        .from("reservations")
        .select("id, tenant_id, reservation_type, resource_id, guest_email")
        .eq("guest_email", GUEST.guest_email);

      expect(queryErr, `reservations lookup failed: ${queryErr?.message}`).toBeNull();
      expect(
        rows?.length,
        `expected exactly 3 reservations for ${GUEST.guest_email}, got ${rows?.length}`,
      ).toBe(3);

      for (const row of rows ?? []) {
        expect(
          row.tenant_id,
          `reservation ${row.id} (${row.reservation_type}) wrote tenant_id=${row.tenant_id}, expected ${tenant.id}`,
        ).toBe(tenant.id);
      }

      const types = (rows ?? []).map((r) => r.reservation_type).sort();
      expect(types).toEqual(["guesthouse", "restaurant", "venue"]);

      // Cleanup test rows so reruns stay deterministic.
      await admin.from("reservations").delete().eq("guest_email", GUEST.guest_email);
    } else {
      console.warn(
        "[cross-booking] E2E_SUPABASE_SERVICE_ROLE_KEY not set; skipping RLS / tenant-isolation DB verification.",
      );
    }

    // Surface guest identifier so manual cleanup is easy after the run
    console.log(`[cross-booking] created reservations for guest "${GUEST.guest_name}" (${GUEST.guest_email})`);
    } finally {
      // Closing the request context flushes the HAR to disk. Always attach it
      // (success OR failure) so the exact public-booking traffic for this run
      // can be replayed in a browser via Chrome DevTools "Import HAR file"
      // or inspected from the Playwright HTML report.
      try {
        // dispose() flushes the HAR to disk in Playwright >= 1.32.
        await request.dispose({ reason: "test finished, flush HAR" });
      } catch (disposeErr) {
        // eslint-disable-next-line no-console
        console.warn(`[cross-booking] request.dispose failed: ${(disposeErr as Error)?.message}`);
      }
      try {
        const exists = fs.existsSync(harPath);
        const size = exists ? fs.statSync(harPath).size : 0;
        // eslint-disable-next-line no-console
        console.log(`[cross-booking] HAR file exists=${exists} size=${size} path=${harPath}`);
        if (exists && size > 0) {
          await testInfo.attach(`public-booking-attempt-${testInfo.retry + 1}.har`, {
            path: harPath,
            contentType: "application/json",
          });
        }
      } catch (attachErr) {
        // eslint-disable-next-line no-console
        console.warn(`[cross-booking] failed to attach HAR: ${(attachErr as Error)?.message}`);
      }
    }
  });
});
