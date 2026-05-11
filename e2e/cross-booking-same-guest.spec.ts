import {
  test,
  expect,
  SUPABASE_URL,
  futureDate,
  makeTestGuest,
} from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { gotoAndWaitForSpa } from "./fixtures/spa-waits";
import {
  callPublicBooking,
  validatePublicBookingErrorShape,
  writeHarFile,
  type HarEntry,
  type PublicBookingResult,
} from "./fixtures/public-booking-client";

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
 * All wait/retry/diagnostic logic lives in shared helpers under
 * `e2e/fixtures/` so this spec stays focused on orchestration + assertions.
 */

const GUEST = makeTestGuest("Cross");
const LOG_PREFIX = "[cross-booking]";

test.describe("Cross-booking: same guest, multiple resources/services", () => {
  test("public booking page for the test tenant loads", async ({ page, tenant }) => {
    test.setTimeout(60_000);
    await gotoAndWaitForSpa(page, `/book/${tenant.slug}`);
  });

  test("creates restaurant + guesthouse + venue reservations for the same guest", async ({ request, tenant }, testInfo) => {
    const date = futureDate(60);
    const checkOut = futureDate(62);

    // HAR collector and one umbrella correlation id for the entire flow.
    const path = await import("node:path");
    const harEntries: HarEntry[] = [];
    const harPath = path.resolve(
      testInfo.outputDir,
      "har",
      `public-booking-attempt-${testInfo.retry + 1}.har`,
    );
    const flowCorrelationId = `cross-booking/${testInfo.project.name || "default"}/retry-${testInfo.retry}/${
      globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)
    }`;
    // eslint-disable-next-line no-console
    console.log(`${LOG_PREFIX} HAR will be written to ${harPath}`);
    // eslint-disable-next-line no-console
    console.log(`${LOG_PREFIX} flow correlation_id=${flowCorrelationId}`);
    testInfo.annotations.push({ type: "correlation_id", description: flowCorrelationId });

    const callLeg = (label: string, body: Record<string, unknown>) =>
      callPublicBooking({
        request,
        body,
        label,
        harEntries,
        parentCorrelationId: flowCorrelationId,
        logPrefix: LOG_PREFIX,
      });

    const expectLegSuccess = (
      result: PublicBookingResult,
      label: string,
      extraShapeAssert?: (body: any) => void,
    ) => {
      expect(
        result.status,
        `${label} booking failed: ${JSON.stringify(result.diagnostic, null, 2)}`,
      ).toBeLessThan(400);
      expect(result.body, `${label} response shape`).toMatchObject({ success: true });
      extraShapeAssert?.(result.body);
    };

    // Warmup is best-effort; ignore failures so a cold edge node doesn't
    // blow up the test before we even start the real legs.
    await callLeg("warmup", { warmup: true }).catch(() => undefined);

    try {
      const restaurant = await callLeg("restaurant", {
        tenant_id: tenant.id,
        ...GUEST,
        guests_count: 2,
        reservation_type: "restaurant",
        resource_id: tenant.resources.restaurant,
        date,
        start_time: "19:00",
        special_requests: "TEST: cross-booking restaurant leg",
      });
      expectLegSuccess(restaurant, "restaurant", (body) => {
        expect(body?.capacity, "restaurant capacity payload").toBeTruthy();
      });

      const guesthouse = await callLeg("guesthouse", {
        tenant_id: tenant.id,
        ...GUEST,
        guests_count: 2,
        reservation_type: "guesthouse",
        resource_id: tenant.resources.guesthouse,
        date,
        check_out_date: checkOut,
        special_requests: "TEST: cross-booking guesthouse leg",
      });
      expectLegSuccess(guesthouse, "guesthouse");

      const venue = await callLeg("venue", {
        tenant_id: tenant.id,
        ...GUEST,
        guests_count: 30,
        reservation_type: "venue",
        resource_id: tenant.resources.venue,
        date,
        start_time: "12:00",
        event_type: "corporate",
        special_requests: "TEST: cross-booking venue leg",
      });
      expectLegSuccess(venue, "venue");

      // Negative check: foreign tenant_id MUST be rejected, and the error
      // body MUST conform to the documented `{ error: string }` contract.
      const FAKE_TENANT_ID = "00000000-0000-0000-0000-000000000000";
      const rejected = await callLeg("foreign-tenant-negative", {
        tenant_id: FAKE_TENANT_ID,
        ...GUEST,
        guests_count: 2,
        reservation_type: "restaurant",
        resource_id: tenant.resources.restaurant,
        date,
        start_time: "19:30",
        special_requests: "TEST: cross-booking foreign-tenant negative",
      });
      expect(
        rejected.status,
        `foreign tenant_id should be rejected by public-booking but got HTTP ${rejected.status}`,
      ).toBeGreaterThanOrEqual(400);
      const rejectedShapeProblems = validatePublicBookingErrorShape(rejected.body);
      expect(
        rejectedShapeProblems,
        `foreign-tenant-negative error body does not match expected schema { error: string }.\n` +
          `Problems:\n  - ${rejectedShapeProblems.join("\n  - ")}\n` +
          `Received body:\n${JSON.stringify(rejected.body, null, 2)}`,
      ).toEqual([]);

      // RLS / tenant-isolation verification (best-effort, requires service role).
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
        await admin.from("reservations").delete().eq("guest_email", GUEST.guest_email);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `${LOG_PREFIX} E2E_SUPABASE_SERVICE_ROLE_KEY not set; skipping RLS / tenant-isolation DB verification.`,
        );
      }

      // eslint-disable-next-line no-console
      console.log(
        `${LOG_PREFIX} created reservations for guest "${GUEST.guest_name}" (${GUEST.guest_email})`,
      );
    } finally {
      await writeHarFile({
        harPath,
        attachmentName: `public-booking-attempt-${testInfo.retry + 1}.har`,
        entries: harEntries,
        creatorName: "mimmobook-cross-booking-spec",
        testInfo,
        logPrefix: LOG_PREFIX,
      });
    }
  });
});
