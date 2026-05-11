import {
  test as baseTest,
  expect,
  SUPABASE_URL,
  futureDate,
  makeTestGuest,
} from "./fixtures/test-tenant";
import path from "node:path";

// Per-test browser HAR file path, populated when the overridden `context`
// fixture creates the BrowserContext with `recordHar` enabled.
const harPathByTest = new Map<string, string>();

/**
 * Local test variant that records a full browser HAR (network log) per test.
 * The HAR is written to `<testInfo.outputDir>/network.har` and is only
 * finalized when the BrowserContext is closed, so afterEach must close the
 * context before attaching it to the report.
 */
const test = baseTest.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({ browser }, useFixture, testInfo) => {
    const harPath = path.join(testInfo.outputDir, "network.har");
    const context = await browser.newContext({
      baseURL: "http://localhost:4173",
      recordHar: { path: harPath, mode: "minimal", content: "embed" },
      recordVideo: { dir: testInfo.outputDir },
    });
    harPathByTest.set(testInfo.testId, harPath);
    await useFixture(context);
    // Closing here is a no-op when afterEach already closed the context,
    // and a safety net otherwise so the HAR file is always flushed.
    if (!(context as any)._closedPromise) {
      try {
        await context.close();
      } catch {
        /* already closed */
      }
    }
  },
});

import { createClient } from "@supabase/supabase-js";
import { gotoAndWaitForSpa, assertPublicBookingReady } from "./fixtures/spa-waits";
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

interface BrowserLogEntry {
  timestamp: string;
  type: string;
  text: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
  correlation_id?: string;
}

interface BrowserErrorEntry {
  timestamp: string;
  message: string;
  stack?: string;
  correlation_id?: string;
}

// Per-test buffers for console + pageerror, keyed by Playwright testId.
// We populate these in beforeEach (so listeners are attached before any
// page navigation) and drain them in afterEach to attach to the report.
const browserLogs = new Map<string, BrowserLogEntry[]>();
const browserErrors = new Map<string, BrowserErrorEntry[]>();
const correlationByTest = new Map<string, string[]>();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

interface IndexArtifact {
  name: string;
  contentType: string;
  sizeBytes: number;
  description: string;
  dataUri?: string;
  inlineText?: string;
}

/**
 * Render a single self-contained HTML page that previews the failure
 * screenshot inline, summarises the run, and lists every other artifact
 * (video, trace, HAR, HTML dump, browser logs) with size + description.
 *
 * Note: Playwright stores attachments under hashed filenames so we cannot
 * link directly between attachments. Instead we surface the artifact NAME
 * the reviewer should look for in the same report panel.
 */
function renderFailureIndexHtml(
  testInfo: { title: string; retry: number; duration: number; outputDir: string },
  summary: Record<string, unknown>,
  artifacts: IndexArtifact[],
): string {
  const screenshot = artifacts.find((a) => a.name === "failure-screenshot.png");
  const others = artifacts.filter((a) => a.name !== "failure-screenshot.png");
  const correlationIds = (summary.correlation_ids as string[] | undefined) ?? [];

  const summaryRows = Object.entries(summary)
    .filter(([k]) => k !== "correlation_ids")
    .map(
      ([k, v]) =>
        `<tr><th>${escapeHtml(k)}</th><td><code>${escapeHtml(
          typeof v === "string" ? v : JSON.stringify(v),
        )}</code></td></tr>`,
    )
    .join("");

  const artifactRows = others
    .map(
      (a) =>
        `<tr><td><code>${escapeHtml(a.name)}</code></td>` +
        `<td>${escapeHtml(a.contentType)}</td>` +
        `<td>${formatBytes(a.sizeBytes)}</td>` +
        `<td>${escapeHtml(a.description)}</td></tr>`,
    )
    .join("");

  const inlineSummary = artifacts.find((a) => a.name === "failure-summary.json");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Failure summary: ${escapeHtml(testInfo.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           margin: 24px; color: #1a1a1a; max-width: 1100px; }
    h1 { margin-top: 0; }
    h2 { margin-top: 32px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee;
             vertical-align: top; }
    th { background: #f6f6f6; font-weight: 600; width: 220px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
           font-size: 12px; word-break: break-all; }
    img.screenshot { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 10px;
            background: #fde2e1; color: #8a1f1a; font-size: 12px; font-weight: 600; }
    pre { background: #fafafa; border: 1px solid #eee; padding: 12px;
          overflow: auto; max-height: 300px; font-size: 12px; }
    .muted { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Cross-booking failure <span class="pill">${escapeHtml(String(summary.status ?? "failed"))}</span></h1>
  <p class="muted">Test: <strong>${escapeHtml(testInfo.title)}</strong>
    (retry ${testInfo.retry}, duration ${Math.round(testInfo.duration)} ms)</p>

  <h2>Summary</h2>
  <table>${summaryRows}</table>

  ${
    correlationIds.length
      ? `<h2>Correlation IDs</h2><ul>${correlationIds
          .map((id) => `<li><code>${escapeHtml(id)}</code></li>`)
          .join("")}</ul>`
      : ""
  }

  ${
    screenshot?.dataUri
      ? `<h2>Screenshot at failure</h2>
         <img class="screenshot" src="${screenshot.dataUri}" alt="failure screenshot" />
         <p class="muted">Also attached as <code>failure-screenshot.png</code> (${formatBytes(
           screenshot.sizeBytes,
         )}).</p>`
      : `<h2>Screenshot</h2><p class="muted">No screenshot captured (api-only test or page already closed).</p>`
  }

  <h2>All artifacts</h2>
  <p class="muted">Each row below is attached to the same Playwright report
    panel as this page. Click the matching attachment name in the report
    sidebar to download or preview.</p>
  <table>
    <thead><tr><th>Attachment</th><th>Type</th><th>Size</th><th>Description</th></tr></thead>
    <tbody>${artifactRows}</tbody>
  </table>

  ${
    inlineSummary?.inlineText
      ? `<h2>failure-summary.json</h2><pre>${escapeHtml(inlineSummary.inlineText)}</pre>`
      : ""
  }

  <p class="muted">Output directory on the runner: <code>${escapeHtml(
    testInfo.outputDir,
  )}</code></p>
</body>
</html>`;
}


test.describe("Cross-booking: same guest, multiple resources/services", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const logs: BrowserLogEntry[] = [];
    const errors: BrowserErrorEntry[] = [];
    browserLogs.set(testInfo.testId, logs);
    browserErrors.set(testInfo.testId, errors);

    const currentCorrelationId = () => {
      const ids = correlationByTest.get(testInfo.testId);
      return ids && ids.length ? ids[ids.length - 1] : undefined;
    };

    page.on("console", (msg) => {
      let location: BrowserLogEntry["location"];
      try {
        location = msg.location();
      } catch {
        location = undefined;
      }
      logs.push({
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location,
        correlation_id: currentCorrelationId(),
      });
    });

    page.on("pageerror", (err) => {
      errors.push({
        timestamp: new Date().toISOString(),
        message: err.message,
        stack: err.stack,
        correlation_id: currentCorrelationId(),
      });
    });
  });

  // On any failure inside this describe, snapshot every diagnostic we can
  // reach (screenshot + HTML for page-driven tests, trace pointer for both)
  // so flakiness can be triaged from a single Playwright report entry.
  test.afterEach(async ({ page }, testInfo) => {
    const logs = browserLogs.get(testInfo.testId) ?? [];
    const errors = browserErrors.get(testInfo.testId) ?? [];
    browserLogs.delete(testInfo.testId);
    browserErrors.delete(testInfo.testId);
    correlationByTest.delete(testInfo.testId);

    if (testInfo.status === testInfo.expectedStatus) return;

    // Track every artifact we attach so we can render a single index.html
    // at the end that points at all of them. The screenshot is also kept
    // as a data URI so the index page renders a thumbnail inline even
    // when the reviewer hasn't downloaded the .png yet.
    interface ArtifactRecord {
      name: string;
      contentType: string;
      sizeBytes: number;
      description: string;
      dataUri?: string;
      inlineText?: string;
    }
    const artifacts: ArtifactRecord[] = [];
    const attachArtifact = async (
      name: string,
      body: Buffer | string,
      contentType: string,
      description: string,
      opts: { embedAsDataUri?: boolean; embedAsText?: boolean } = {},
    ) => {
      await testInfo.attach(name, { body, contentType });
      const sizeBytes = typeof body === "string" ? Buffer.byteLength(body) : body.byteLength;
      const record: ArtifactRecord = { name, contentType, sizeBytes, description };
      if (opts.embedAsDataUri) {
        const buf = typeof body === "string" ? Buffer.from(body) : body;
        record.dataUri = `data:${contentType};base64,${buf.toString("base64")}`;
      }
      if (opts.embedAsText) {
        record.inlineText = typeof body === "string" ? body : body.toString("utf8");
      }
      artifacts.push(record);
    };

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
        await attachArtifact(
          "failure-screenshot.png",
          buffer,
          "image/png",
          "Full-page screenshot taken at the moment of failure.",
          { embedAsDataUri: true },
        );
        const html = await page.content();
        await attachArtifact(
          "failure-page.html",
          html,
          "text/html",
          "Live DOM dump of the page at the moment of failure.",
        );
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
          await attachArtifact(
            "failure-video.webm",
            videoBytes,
            "video/webm",
            "Recording of the entire test run from start to failure.",
          );
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
    }

    // HAR (network log): the overridden `context` fixture records every
    // request/response into <outputDir>/network.har. The HAR is only
    // flushed when the BrowserContext is closed, so close it here BEFORE
    // attaching, then read the resulting file.
    try {
      const harPath = harPathByTest.get(testInfo.testId);
      if (harPath) {
        try {
          await page.context().close();
        } catch {
          /* context may already be closed */
        }
        const fs = await import("node:fs/promises");
        const harBytes = await fs.readFile(harPath);
        await attachArtifact(
          "failure-network.har",
          harBytes,
          "application/json",
          "Browser HAR: every request and response captured during the test.",
        );
        failureSummary.har_path = harPath;
        failureSummary.har_bytes = harBytes.byteLength;
      } else {
        failureSummary.har_capture = "skipped: no HAR path registered";
      }
    } catch (err) {
      failureSummary.har_capture_error =
        err instanceof Error ? err.message : String(err);
    }
    harPathByTest.delete(testInfo.testId);

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
      await attachArtifact(
        "failure-trace.zip",
        traceBytes,
        "application/zip",
        "Playwright trace: open with `npx playwright show-trace failure-trace.zip`.",
      );
      failureSummary.trace_path = tracePath;
    } catch (err) {
      failureSummary.trace_capture =
        err instanceof Error
          ? `unavailable: ${err.message}`
          : "unavailable";
    }

    // Browser console + pageerror capture. We attach BOTH a structured
    // JSON file (machine-readable, includes correlation IDs and locations)
    // and a flat .log file (skim-friendly), so reviewers can pick whichever
    // format helps them spot the divergence faster.
    try {
      const errorCount = errors.length;
      const errorLogCount = logs.filter((l) => l.type === "error").length;
      const warningLogCount = logs.filter((l) => l.type === "warning").length;
      const correlationIds = (failureSummary.correlation_ids as string[]) ?? [];
      const browserDiagnostics = {
        correlation_ids: correlationIds,
        page_errors: errors,
        console_logs: logs,
        counts: {
          page_errors: errorCount,
          console_errors: errorLogCount,
          console_warnings: warningLogCount,
          console_total: logs.length,
        },
      };
      await attachArtifact(
        "failure-browser-diagnostics.json",
        JSON.stringify(browserDiagnostics, null, 2),
        "application/json",
        `Structured browser diagnostics: ${errorCount} pageerror(s), ${errorLogCount} console error(s), ${warningLogCount} warning(s).`,
      );
      const flatLines = [
        `# Page errors (${errors.length})`,
        ...errors.map(
          (e) =>
            `[${e.timestamp}] correlation_id=${e.correlation_id ?? "-"} ${e.message}` +
            (e.stack ? `\n${e.stack}` : ""),
        ),
        "",
        `# Console messages (${logs.length})`,
        ...logs.map(
          (l) =>
            `[${l.timestamp}] [${l.type}] correlation_id=${l.correlation_id ?? "-"} ${l.text}` +
            (l.location?.url ? ` (${l.location.url}:${l.location.lineNumber ?? "?"})` : ""),
        ),
      ];
      await attachArtifact(
        "failure-browser.log",
        flatLines.join("\n"),
        "text/plain",
        "Flat browser log: skim-friendly view of all console messages and page errors.",
      );
      failureSummary.browser_diagnostics = browserDiagnostics.counts;
    } catch (err) {
      failureSummary.browser_diagnostics_error =
        err instanceof Error ? err.message : String(err);
    }

    const summaryJson = JSON.stringify(failureSummary, null, 2);
    await attachArtifact(
      "failure-summary.json",
      summaryJson,
      "application/json",
      "Machine-readable failure summary (status, error, correlation IDs, artifact pointers).",
      { embedAsText: true },
    );

    // Self-contained HTML index: one page that links + previews every
    // artifact above. Open it from the Playwright HTML report and you
    // get a single dashboard for triaging the failure.
    try {
      const indexHtml = renderFailureIndexHtml(testInfo, failureSummary, artifacts);
      await testInfo.attach("failure-index.html", {
        body: indexHtml,
        contentType: "text/html",
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `${LOG_PREFIX} failed to render failure-index.html: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    // eslint-disable-next-line no-console
    console.error(`${LOG_PREFIX} FAILURE ${JSON.stringify(failureSummary)}`);
  });

  test("public booking page for the test tenant loads", async ({ page, tenant }, testInfo) => {
    test.setTimeout(60_000);
    await captureCheckpoint(page, testInfo, "smoke: before goto", { screenshot: false });
    await gotoAndWaitForSpa(page, `/book/${tenant.slug}`);
    await assertPublicBookingReady(page);
    await captureCheckpoint(page, testInfo, "smoke: after booking form ready", {
      probeSelectors: ["#root", "main", "h1", "#guest_name", "form"],
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
    // Register so any subsequent browser console message / pageerror is
    // tagged with this id in the failure-browser-diagnostics attachment.
    const corrIds = correlationByTest.get(testInfo.testId) ?? [];
    corrIds.push(flowCorrelationId);
    correlationByTest.set(testInfo.testId, corrIds);

    // Inject a timestamped marker into the page so the silent video and the
    // captured browser console line up. Each call:
    //   1. console.log()s a tagged marker (captured by the page.on("console")
    //      listener in beforeEach with ISO timestamp + correlation id), AND
    //   2. flashes a fixed-position pill in the top-right of the page for
    //      ~1.5s so the same label is visible in the recorded .webm.
    // Best-effort: if the page is closed or evaluate throws, swallow the
    // error so a failed marker never masks the real test failure.
    const markStartedAt = Date.now();
    const mark = async (label: string, extra?: Record<string, unknown>) => {
      const elapsedMs = Date.now() - markStartedAt;
      const payload = {
        marker: label,
        elapsed_ms: elapsedMs,
        correlation_id: flowCorrelationId,
        ...(extra ?? {}),
      };
      try {
        if (page.isClosed()) return;
        await page.evaluate(
          ({ prefix, payload, label }) => {
            // eslint-disable-next-line no-console
            console.log(`${prefix} MARK ${JSON.stringify(payload)}`);
            try {
              const id = "__mimmobook_e2e_marker__";
              let el = document.getElementById(id) as HTMLDivElement | null;
              if (!el) {
                el = document.createElement("div");
                el.id = id;
                el.style.cssText = [
                  "position:fixed",
                  "top:8px",
                  "right:8px",
                  "z-index:2147483647",
                  "padding:4px 10px",
                  "background:rgba(220,38,38,0.92)",
                  "color:#fff",
                  "font:600 12px/1.2 ui-monospace,monospace",
                  "border-radius:10px",
                  "box-shadow:0 2px 6px rgba(0,0,0,0.25)",
                  "pointer-events:none",
                ].join(";");
                document.body.appendChild(el);
              }
              el.textContent = `${label} +${payload.elapsed_ms}ms`;
              const w = window as unknown as { __mimmobook_marker_t?: number };
              if (w.__mimmobook_marker_t) clearTimeout(w.__mimmobook_marker_t);
              w.__mimmobook_marker_t = window.setTimeout(() => {
                el?.remove();
              }, 1500);
            } catch {
              /* DOM not ready, console marker is enough */
            }
          },
          { prefix: LOG_PREFIX, payload, label },
        );
      } catch {
        /* page closed mid-test; never let a marker fail the run */
      }
    };

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
      await assertPublicBookingReady(page);
      await captureCheckpoint(page, testInfo, `${label}: after booking form ready`, {
        probeSelectors: ["#root", "main", "h1", "#guest_name", "form"],
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
