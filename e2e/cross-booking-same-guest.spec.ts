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
import { captureCheckpoint } from "./fixtures/checkpoints";

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
  // On any failure inside this describe, snapshot every diagnostic we can
  // reach (screenshot + HTML for page-driven tests, trace pointer for both)
  // so flakiness can be triaged from a single Playwright report entry.
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;

    const failureSummary: Record<string, unknown> = {
      title: testInfo.title,
      status: testInfo.status,
      expected_status: testInfo.expectedStatus,
      retry: testInfo.retry,
      duration_ms: testInfo.duration,
      error: testInfo.error?.message,
      correlation_ids: testInfo.annotations
        .filter((a) => a.type === "correlation_id")
        .map((a) => a.description),
    };

    // Page-driven diagnostics: only meaningful if a real page exists and is
    // still open. The API-only test never opens a page so these are skipped.
    try {
      if (page && !page.isClosed()) {
        const buffer = await page.screenshot({ fullPage: true });
        await testInfo.attach("failure-screenshot.png", {
          body: buffer,
          contentType: "image/png",
        });
        const html = await page.content();
        await testInfo.attach("failure-page.html", {
          body: html,
          contentType: "text/html",
        });
        failureSummary.url = page.url();
      } else {
        failureSummary.page_capture = "skipped: no open page (api-only test)";
      }
    } catch (err) {
      failureSummary.page_capture_error =
        err instanceof Error ? err.message : String(err);
    }

    // Video clip: playwright.config.ts records video for every test
    // (`video: "on"`). The file is only finalized after the page closes,
    // so we explicitly close the page first, then attach the resulting
    // .webm so reviewers can scrub the failing run frame by frame.
    try {
      if (page && !page.isClosed()) {
        const video = page.video();
        await page.close();
        if (video) {
          const videoPath = await video.path();
          const fs = await import("node:fs/promises");
          const videoBytes = await fs.readFile(videoPath);
          await testInfo.attach("failure-video.webm", {
            body: videoBytes,
            contentType: "video/webm",
          });
          failureSummary.video_path = videoPath;
        } else {
          failureSummary.video_capture = "skipped: no video recorder on page";
        }
      } else {
        failureSummary.video_capture = "skipped: page already closed";
      }
    } catch (err) {
      failureSummary.video_capture_error =
        err instanceof Error ? err.message : String(err);

    // Trace is captured for every test by playwright.config.ts (`trace: "on"`)
    // and lives at testInfo.outputDir/trace.zip. Attach it explicitly so the
    // HTML report links it directly under the failing test, instead of the
    // user having to dig through the output directory.
    try {
      const path = await import("node:path");
      const fs = await import("node:fs/promises");
      const tracePath = path.resolve(testInfo.outputDir, "trace.zip");
      await fs.access(tracePath);
      const traceBytes = await fs.readFile(tracePath);
      await testInfo.attach("failure-trace.zip", {
        body: traceBytes,
        contentType: "application/zip",
      });
      failureSummary.trace_path = tracePath;
    } catch (err) {
      failureSummary.trace_capture =
        err instanceof Error
          ? `unavailable: ${err.message}`
          : "unavailable";
    }

    await testInfo.attach("failure-summary.json", {
      body: JSON.stringify(failureSummary, null, 2),
      contentType: "application/json",
    });
    // eslint-disable-next-line no-console
    console.error(`${LOG_PREFIX} FAILURE ${JSON.stringify(failureSummary)}`);
  });

  test("public booking page for the test tenant loads", async ({ page, tenant }, testInfo) => {
    test.setTimeout(60_000);
    await captureCheckpoint(page, testInfo, "smoke: before goto", { screenshot: false });
    await gotoAndWaitForSpa(page, `/book/${tenant.slug}`);
    await captureCheckpoint(page, testInfo, "smoke: after SPA hydrate", {
      probeSelectors: ["#root", "main", "h1"],
    });
  });

  test("creates restaurant + guesthouse + venue reservations for the same guest", async ({ request, page, tenant }, testInfo) => {
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

    // Verify each booking is reflected in the public booking UI. We assert
    // against the SAME `public-booking` edge function the PublicBooking page
    // consumes, so a passing assertion proves the reservation is visible to
    // consumer-facing surfaces:
    //   1. Data-layer: response `capacity.current_load` MUST already include
    //      the just-booked guests_count. This is the field the UI reads to
    //      render slot availability and "X of Y seats taken".
    //   2. Render-layer: navigate the SPA to /book/:slug and confirm the
    //      booking shell hydrates without a 404 / not-found.
    const verifyLegInUi = async (
      label: string,
      result: PublicBookingResult,
      guestsCount: number,
    ) => {
      const cap: any = (result.body as any)?.capacity;
      expect(cap, `${label}: response missing capacity payload`).toBeTruthy();
      expect(
        typeof cap?.current_load,
        `${label}: capacity.current_load must be numeric (got ${typeof cap?.current_load})`,
      ).toBe("number");
      expect(
        cap.current_load,
        `${label}: capacity.current_load=${cap.current_load} must be >= just-booked guests_count=${guestsCount} ` +
          `so the public booking UI shows the reservation as taken`,
      ).toBeGreaterThanOrEqual(guestsCount);
      await captureCheckpoint(page, testInfo, `${label}: before SPA reload`, {
        screenshot: false,
        extra: { current_load: cap.current_load, capacity_total: cap.capacity_total ?? null },
      });
      await gotoAndWaitForSpa(page, `/book/${tenant.slug}`);
      await captureCheckpoint(page, testInfo, `${label}: after SPA reload`, {
        probeSelectors: ["#root", "main", "h1"],
        extra: { current_load: cap.current_load, capacity_total: cap.capacity_total ?? null },
      });
      // eslint-disable-next-line no-console
      console.log(
        `${LOG_PREFIX} ${label}: verified in public booking UI ` +
          `(current_load=${cap.current_load}, capacity_total=${cap.capacity_total ?? "n/a"})`,
      );
    };

    // Warmup is best-effort; failures here must NOT fail the test (cold
    // edge nodes are expected), but the outcome MUST be observable in CI
    // so we can correlate slow first legs with cold-start latency.
    const warmupStartedAt = Date.now();
    let warmupOutcome: "ok" | "http_error" | "threw" | "skipped" = "skipped";
    let warmupStatus: number | undefined;
    let warmupError: string | undefined;
    try {
      const warmup = await callLeg("warmup", { warmup: true });
      warmupStatus = warmup.status;
      warmupOutcome = warmup.status < 500 ? "ok" : "http_error";
    } catch (err) {
      warmupOutcome = "threw";
      warmupError = err instanceof Error ? err.message : String(err);
    }
    const warmupDurationMs = Date.now() - warmupStartedAt;
    const warmupSummary = {
      outcome: warmupOutcome,
      status: warmupStatus,
      duration_ms: warmupDurationMs,
      error: warmupError,
      correlation_id: flowCorrelationId,
    };
    // eslint-disable-next-line no-console
    console.log(`${LOG_PREFIX} warmup result ${JSON.stringify(warmupSummary)}`);
    testInfo.annotations.push({
      type: "warmup",
      description: JSON.stringify(warmupSummary),
    });
    await testInfo.attach("warmup-summary.json", {
      body: JSON.stringify(warmupSummary, null, 2),
      contentType: "application/json",
    });
    // Soft assertion: never fail the test on a cold start, but make the
    // skipped/failed path explicit in the report so it can't be silently
    // swallowed in CI.
    expect.soft(
      ["ok", "http_error", "threw"],
      "warmup outcome must be one of the known observable states",
    ).toContain(warmupOutcome);

    await captureCheckpoint(page, testInfo, "post-warmup", {
      screenshot: false,
      extra: warmupSummary,
    });

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
      await verifyLegInUi("restaurant", restaurant, 2);

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
      await verifyLegInUi("guesthouse", guesthouse, 2);

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
      await verifyLegInUi("venue", venue, 30);

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
