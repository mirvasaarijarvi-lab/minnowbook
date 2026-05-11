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

// Expected error response shape from the `public-booking` edge function.
// Source of truth: supabase/functions/public-booking/index.ts always
// responds with `{ error: string }` for any non-2xx outcome (rate limit,
// payload too large, invalid tenant, validation failure, internal throw).
type PublicBookingErrorBody = { error: string };

/**
 * Validate that an error body matches `{ error: string }`. Returns a list of
 * human-readable problems (empty array means the body conforms). Used to
 * fail the test with a precise, actionable message instead of a generic
 * `expect(...).toMatchObject` diff.
 */
function validatePublicBookingErrorShape(body: unknown): string[] {
  const problems: string[] = [];
  if (body === null || body === undefined) {
    problems.push("response body is null/undefined (expected JSON object)");
    return problems;
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    problems.push(
      `response body is ${Array.isArray(body) ? "an array" : typeof body}, expected a JSON object`,
    );
    return problems;
  }
  const obj = body as Record<string, unknown>;
  if (!("error" in obj)) {
    problems.push(`response body is missing required "error" field (got keys: ${Object.keys(obj).join(", ") || "<none>"})`);
  } else if (typeof obj.error !== "string") {
    problems.push(`"error" field is ${typeof obj.error}, expected string`);
  } else if (obj.error.trim() === "") {
    problems.push(`"error" field is an empty string`);
  }
  return problems;
}

/**
 * Build a W3C-compatible traceparent header from a correlation id.
 * Format: `00-<32hex traceid>-<16hex spanid>-01`. We hash the correlation
 * id with a tiny, deterministic FNV-style fold so the same correlation id
 * always produces the same traceparent (useful for grepping logs across
 * retries) without pulling in a crypto dependency.
 */
function buildTraceparent(correlationId: string): string {
  const hex = (n: number, len: number) =>
    (n >>> 0).toString(16).padStart(len, "0").slice(-len);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < correlationId.length; i++) {
    const c = correlationId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  const traceId = (hex(h1, 8) + hex(h2, 8) + hex(h1 ^ h2, 8) + hex(h1 + h2, 8)).slice(0, 32);
  const spanId = (hex(h2, 8) + hex(h1, 8)).slice(0, 16);
  return `00-${traceId}-${spanId}-01`;
}

// HAR 1.2 entry shape (subset). Browsers (Chrome/Firefox DevTools) and
// `npx playwright show-trace` can import any spec-conformant HAR file.
type HarEntry = Record<string, any>;

function buildHarEntry(args: {
  startedAt: number;
  durationMs: number;
  url: string;
  reqHeaders: Record<string, string>;
  reqBody: unknown;
  status: number;
  statusText: string;
  resHeaders: Record<string, string>;
  resBodyText: string;
  resContentType: string;
}): HarEntry {
  const reqBodyText =
    typeof args.reqBody === "string" ? args.reqBody : JSON.stringify(args.reqBody);
  const toHeaderArray = (h: Record<string, string>) =>
    Object.entries(h).map(([name, value]) => ({ name, value }));
  return {
    startedDateTime: new Date(args.startedAt).toISOString(),
    time: args.durationMs,
    request: {
      method: "POST",
      url: args.url,
      httpVersion: "HTTP/1.1",
      headers: toHeaderArray(args.reqHeaders),
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: Buffer.byteLength(reqBodyText, "utf-8"),
      postData: {
        mimeType: args.reqHeaders["Content-Type"] ?? "application/json",
        text: reqBodyText,
      },
    },
    response: {
      status: args.status,
      statusText: args.statusText,
      httpVersion: "HTTP/1.1",
      headers: toHeaderArray(args.resHeaders),
      cookies: [],
      content: {
        size: Buffer.byteLength(args.resBodyText, "utf-8"),
        mimeType: args.resContentType || "application/json",
        text: args.resBodyText,
      },
      redirectURL: "",
      headersSize: -1,
      bodySize: Buffer.byteLength(args.resBodyText, "utf-8"),
    },
    cache: {},
    timings: {
      send: 0,
      wait: args.durationMs,
      receive: 0,
    },
  };
}

async function callPublicBooking(
  request: import("@playwright/test").APIRequestContext,
  body: Record<string, unknown>,
  label: string,
  harEntries?: HarEntry[],
  parentCorrelationId?: string,
) {
  const url = `${SUPABASE_URL}/functions/v1/public-booking`;
  // One correlation id per logical leg, generated up-front and reused on
  // every retry. Each physical attempt also gets its own attempt id appended
  // (`<correlation>/<attempt>`) so a single retried leg can still be unwound
  // from the logs without losing the parent grouping. Callers can pass a
  // `parentCorrelationId` (e.g. a per-test "trace id") to chain everything
  // in one cross-booking flow under one umbrella.
  const correlationId =
    (globalThis.crypto?.randomUUID?.() ??
      `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const fullCorrelationId = parentCorrelationId
    ? `${parentCorrelationId}/${label}/${correlationId}`
    : `${label}/${correlationId}`;

  let lastError: unknown = null;
  let res: import("@playwright/test").APIResponse | null = null;
  let durationMs = 0;
  let startedAt = Date.now();
  let attemptCorrelationId = fullCorrelationId;
  let wireHeaders: Record<string, string> = {};
  let redactedHeaders: Record<string, string> = {};
  for (let attempt = 1; attempt <= PUBLIC_BOOKING_MAX_ATTEMPTS; attempt++) {
    startedAt = Date.now();
    attemptCorrelationId = `${fullCorrelationId}/attempt-${attempt}`;
    // Real headers actually sent on the wire (used for the HAR). The
    // correlation id flows through three header names so it shows up in:
    //   - our own server-side logs (`x-correlation-id`)
    //   - Supabase's request-id propagation (`x-request-id`)
    //   - W3C tracing infra that downstream tooling may sniff (`traceparent`)
    wireHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "x-correlation-id": attemptCorrelationId,
      "x-request-id": attemptCorrelationId,
      // Minimal valid W3C traceparent: version-traceid(32hex)-spanid(16hex)-flags
      traceparent: buildTraceparent(attemptCorrelationId),
    };
    redactedHeaders = {
      ...wireHeaders,
      Authorization: "Bearer <redacted>",
      apikey: "<redacted>",
    };
    try {
      res = await request.post(url, {
        headers: wireHeaders,
        data: body,
        timeout: PUBLIC_BOOKING_TIMEOUT_MS,
      });
      durationMs = Date.now() - startedAt;
      break;
    } catch (err) {
      durationMs = Date.now() - startedAt;
      lastError = err;
      // Capture the failed attempt in the HAR so retries are visible.
      harEntries?.push(
        buildHarEntry({
          startedAt,
          durationMs,
          url,
          reqHeaders: wireHeaders,
          reqBody: body,
          status: 0,
          statusText: `network error: ${(err as Error)?.message ?? err}`,
          resHeaders: {},
          resBodyText: "",
          resContentType: "",
        }),
      );
      // eslint-disable-next-line no-console
      console.warn(
        `[cross-booking] ${label} attempt ${attempt}/${PUBLIC_BOOKING_MAX_ATTEMPTS} threw after ${durationMs}ms (correlation_id=${attemptCorrelationId}): ${(err as Error)?.message ?? err}`,
      );
      if (attempt === PUBLIC_BOOKING_MAX_ATTEMPTS) throw err;
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

  // Push the successful (or 4xx/5xx) attempt into the HAR collector.
  harEntries?.push(
    buildHarEntry({
      startedAt,
      durationMs,
      url,
      reqHeaders: wireHeaders,
      reqBody: body,
      status,
      statusText: res.statusText() || "",
      resHeaders: responseHeaders,
      resBodyText: text,
      resContentType: responseHeaders["content-type"] || "application/json",
    }),
  );

  // Capture Supabase / Cloudflare trace identifiers from the response headers.
  // These are what backend owners need to grep for in `supabase functions
  // logs public-booking` (or the Edge Function Logs panel) to find the
  // exact invocation that produced this response. Header names are
  // case-insensitive on the wire; Playwright already lower-cases them.
  const traceIds = {
    sb_request_id:
      responseHeaders["sb-request-id"] ?? responseHeaders["x-sb-request-id"] ?? null,
    cf_ray: responseHeaders["cf-ray"] ?? null,
    deno_execution_id:
      responseHeaders["x-deno-execution-id"] ??
      responseHeaders["x-deno-ray"] ??
      null,
    deployment_id: responseHeaders["x-sb-deployment-id"] ?? null,
  };

  // Some backends echo the correlation id back; capture both sides so logs
  // can be cross-referenced even if the server rewrites it.
  const echoedCorrelationId =
    responseHeaders["x-correlation-id"] ??
    responseHeaders["x-request-id"] ??
    null;

  const diagnostic = {
    label,
    correlationId: fullCorrelationId,
    attemptCorrelationId,
    echoedCorrelationId,
    traceIds,
    request: { method: "POST", url, headers: redactedHeaders, body },
    response: { status, durationMs, headers: responseHeaders, body: json ?? text },
  };

  const traceLine =
    `correlation_id=${attemptCorrelationId} ` +
    `echoed=${echoedCorrelationId ?? "<none>"} ` +
    `sb-request-id=${traceIds.sb_request_id ?? "<none>"} ` +
    `cf-ray=${traceIds.cf_ray ?? "<none>"} ` +
    `deno-execution-id=${traceIds.deno_execution_id ?? "<none>"}`;

  if (status >= 400) {
    // eslint-disable-next-line no-console
    console.error(
      `\n[cross-booking] ${label} FAILED (HTTP ${status}, ${durationMs}ms)\n` +
        `[cross-booking] ${label} edge-function trace: ${traceLine}\n` +
        `[cross-booking] grep edge logs with: supabase functions logs public-booking | grep -E '${attemptCorrelationId}|${traceIds.sb_request_id ?? "<sb-request-id>"}'\n` +
        JSON.stringify(diagnostic, null, 2) +
        "\n",
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[cross-booking] ${label} OK (HTTP ${status}, ${durationMs}ms) trace: ${traceLine}`,
    );
  }

  // Always attach the per-leg request/response JSON (success AND failure) so
  // we can diff successful legs against failing ones to spot divergence in
  // request shape, headers, or response payload between runs.
  try {
    await test.info().attach(`public-booking-${label}-${status}.json`, {
      body: Buffer.from(JSON.stringify(diagnostic, null, 2), "utf-8"),
      contentType: "application/json",
    });
  } catch {
    /* test.info() unavailable outside test scope */
  }

  // For any non-2xx response, surface schema problems on the diagnostic so
  // callers (and the HTML report attachment) make it obvious WHY the body
  // didn't match the documented `{ error: string }` contract.
  const errorShapeProblems =
    status >= 400 ? validatePublicBookingErrorShape(json ?? text) : [];
  (diagnostic as any).errorShapeProblems = errorShapeProblems;

  return { status, body: json ?? text, diagnostic, errorShapeProblems };
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

  test("creates restaurant + guesthouse + venue reservations for the same guest", async ({ request, tenant }, testInfo) => {
    const date = futureDate(60);
    const checkOut = futureDate(62);

    // Build a HAR 1.2 file from every public-booking call (warmup + 3 legs +
    // negative-tenant probe + any retried attempts) so failures can be
    // replayed in a browser (Chrome/Firefox DevTools "Import HAR file"),
    // diff'd between retries, and shared with backend owners. We assemble
    // the HAR by hand because Playwright's `recordHar` option is browser-
    // context only and is NOT supported on `apiRequest.newContext`.
    const path = await import("node:path");
    const fs = await import("node:fs");
    const harDir = path.resolve(testInfo.outputDir, "har");
    const harPath = path.join(harDir, `public-booking-attempt-${testInfo.retry + 1}.har`);
    fs.mkdirSync(harDir, { recursive: true });
    const harEntries: Array<Record<string, any>> = [];
    // eslint-disable-next-line no-console
    console.log(`[cross-booking] HAR will be written to ${harPath}`);

    // Warm the edge function so the first real leg doesn't pay the cold-start
    // penalty. Recorded into the HAR as a normal entry.
    await callPublicBooking(
      request,
      { warmup: true },
      "warmup",
      harEntries,
    ).catch(() => {
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
      harEntries,
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
      harEntries,
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
      harEntries,
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
      harEntries,
    );
    expect(
      rejected.status,
      `foreign tenant_id should be rejected by public-booking but got HTTP ${rejected.status}`,
    ).toBeGreaterThanOrEqual(400);

    // Validate the error response shape against the documented contract
    // ({ error: string }). A drift here (e.g. `{ message: "..." }` or
    // `{ error: { code, detail } }`) would silently break every UI that
    // surfaces server-side error copy via FunctionsHttpError decoding.
    const rejectedShapeProblems = validatePublicBookingErrorShape(rejected.body);
    expect(
      rejectedShapeProblems,
      `foreign-tenant-negative error body does not match expected schema { error: string }.\n` +
        `Problems:\n  - ${rejectedShapeProblems.join("\n  - ")}\n` +
        `Received body:\n${JSON.stringify(rejected.body, null, 2)}`,
    ).toEqual([]);

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
      // Always write + attach the HAR (success OR failure) so the exact
      // public-booking traffic for this run can be replayed in a browser via
      // Chrome/Firefox DevTools "Import HAR file" or inspected from the
      // Playwright HTML report.
      try {
        const har = {
          log: {
            version: "1.2",
            creator: {
              name: "mimmobook-cross-booking-spec",
              version: "1.0.0",
              comment:
                "Manually assembled HAR (Playwright apiRequest contexts do not support recordHar)",
            },
            browser: { name: "playwright-apirequest", version: "1" },
            pages: [],
            entries: harEntries,
          },
        };
        fs.writeFileSync(harPath, JSON.stringify(har, null, 2), "utf-8");
        const size = fs.statSync(harPath).size;
        // eslint-disable-next-line no-console
        console.log(
          `[cross-booking] HAR exported (${harEntries.length} entries, ${size} bytes) at ${harPath}`,
        );
        await testInfo.attach(`public-booking-attempt-${testInfo.retry + 1}.har`, {
          path: harPath,
          contentType: "application/json",
        });
      } catch (harErr) {
        // eslint-disable-next-line no-console
        console.warn(`[cross-booking] failed to write/attach HAR: ${(harErr as Error)?.message}`);
      }
    }
  });
});
