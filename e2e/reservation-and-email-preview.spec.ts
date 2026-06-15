/**
 * Smoke test: submit a reservation against the shared test tenant via the
 * `public-booking` edge function, then verify the confirmation email preview
 * component renders client-side on the dedicated smoke route.
 *
 * Two assertions in one spec keep the smoke surface small but cover both
 * the data path (edge function + DB insert) and the render path (the React
 * component used inside EditReservationDialog). The guest_name is prefixed
 * with `TEST Lovable Smoke` so the existing `run_test_reservation_cleanup`
 * job sweeps the row up; we do not rely on tear-down here.
 */

import { test, expect } from "./fixtures/test-tenant";
import {
  callPublicBooking,
  type HarEntry,
} from "./fixtures/public-booking-client";
import { futureDate } from "./fixtures/test-tenant";

const LOG_PREFIX = "[smoke:reservation+email-preview]";

test.describe("Smoke: reservation submit + confirmation email preview", () => {
  test("submits a reservation and renders the confirmation email preview", async ({
    page,
    request,
    tenant,
  }, testInfo) => {
    // ----- 1) Submit a reservation through public-booking ------------------
    const stamp = Date.now();
    const guestName = `TEST Lovable Smoke ${stamp}`;
    const guestEmail = `test-smoke-${stamp}@example.com`;
    const bookingDate = futureDate(45);

    const harEntries: HarEntry[] = [];
    const result = await callPublicBooking({
      request,
      label: "smoke-reservation",
      logPrefix: LOG_PREFIX,
      harEntries,
      body: {
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        resource_id: tenant.resources.restaurant,
        reservation_type: "restaurant",
        date: bookingDate,
        start_time: "18:30",
        guests_count: 2,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: "+358 40 0000000",
      },
    });

    await testInfo.attach("public-booking-smoke.har.json", {
      body: JSON.stringify({ log: { version: "1.2", entries: harEntries } }, null, 2),
      contentType: "application/json",
    });

    expect(
      result.status,
      `public-booking smoke failed: ${JSON.stringify(result.diagnostic, null, 2)}`,
    ).toBeLessThan(400);
    expect(result.body, "public-booking response shape").toMatchObject({
      success: true,
      reservation: { id: expect.any(String) },
    });

    // ----- 2) Verify the confirmation email preview renders ----------------
    // Hit the dedicated smoke route which mounts ConfirmationEmailPreview
    // against deterministic mock data. We pass the just-booked guest_name
    // through the query string so a render failure stands out in the report.
    const previewUrl =
      `/__e2e/email-preview?e2e=1` +
      `&guest_name=${encodeURIComponent(guestName)}` +
      `&reservation_type=restaurant`;
    await page.goto(previewUrl);

    const root = page.getByTestId("email-preview-smoke-root");
    await expect(root, "email preview root must mount").toBeVisible();

    const preview = root.getByTestId("confirmation-email-preview");
    await expect(preview, "confirmation email preview must mount").toBeVisible();

    await expect(
      preview.getByTestId("email-preview-guest-name"),
      "preview must echo the guest name we passed in",
    ).toHaveText(guestName);

    await expect(
      preview.getByTestId("email-preview-business-name"),
      "preview header must render the mocked business name",
    ).toHaveText("MimmoBook Smoke Test");


  });
});
