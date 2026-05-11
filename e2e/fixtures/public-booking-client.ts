/**
 * Reusable client + diagnostics for the `public-booking` edge function.
 *
 * Extracted from `cross-booking-same-guest.spec.ts` so any spec that hits
 * `public-booking` can reuse:
 *   - retry-with-correlation-id calls (`callPublicBooking`)
 *   - HAR 1.2 entry building + file writing (`buildHarEntry`, `writeHarFile`)
 *   - error-body schema validation (`validatePublicBookingErrorShape`)
 *   - W3C-style traceparent generation (`buildTraceparent`)
 *
 * Keeping all of this in one place means new specs get the same precise
 * failure messages, log-grep hints, and HAR attachments for free, instead
 * of each spec re-implementing its own ad-hoc diagnostics.
 */

import { test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./test-tenant";

// Per-call HTTP timeout. Edge functions can cold-start (~1.5s typical, up
// to ~5s) so we give each call a generous explicit budget instead of
// relying on Playwright defaults.
export const PUBLIC_BOOKING_TIMEOUT_MS = 30_000;
// One transparent retry on transient network errors (cold start, dropped
// connection). The retry reuses the parent correlation id with a fresh
// `attempt-N` suffix so log grep stays unified.
export const PUBLIC_BOOKING_MAX_ATTEMPTS = 2;

/**
 * Documented error response contract for the `public-booking` edge function.
 * Source of truth: supabase/functions/public-booking/index.ts always
 * responds with `{ error: string }` for any non-2xx outcome.
 */
export type PublicBookingErrorBody = { error: string };

/** Validate `{ error: string }`. Returns human-readable problems (empty = OK). */
export function validatePublicBookingErrorShape(body: unknown): string[] {
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
    problems.push(
      `response body is missing required "error" field (got keys: ${
        Object.keys(obj).join(", ") || "<none>"
      })`,
    );
  } else if (typeof obj.error !== "string") {
    problems.push(`"error" field is ${typeof obj.error}, expected string`);
  } else if (obj.error.trim() === "") {
    problems.push(`"error" field is an empty string`);
  }
  return problems;
}

/**
 * Build a deterministic W3C `traceparent` value from a correlation id.
 * Same correlation id, same traceparent, so retries can be grouped in
 * downstream tracing tooling.
 */
export function buildTraceparent(correlationId: string): string {
  const hex = (n: number, len: number) =>
    (n >>> 0).toString(16).padStart(len, "0").slice(-len);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < correlationId.length; i++) {
    const c = correlationId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  const traceId = (
    hex(h1, 8) + hex(h2, 8) + hex(h1 ^ h2, 8) + hex(h1 + h2, 8)
  ).slice(0, 32);
  const spanId = (hex(h2, 8) + hex(h1, 8)).slice(0, 16);
  return `00-${traceId}-${spanId}-01`;
}

// HAR 1.2 entry shape (subset). Browsers (Chrome/Firefox DevTools) and
// `npx playwright show-trace` can import any spec-conformant HAR file.
export type HarEntry = Record<string, any>;

export function buildHarEntry(args: {
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
    timings: { send: 0, wait: args.durationMs, receive: 0 },
  };
}

/** Write a HAR file from collected entries and attach it to the test report. */
export async function writeHarFile(opts: {
  harPath: string;
  attachmentName: string;
  entries: HarEntry[];
  creatorName?: string;
  testInfo: import("@playwright/test").TestInfo;
  logPrefix?: string;
}): Promise<void> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.mkdirSync(path.dirname(opts.harPath), { recursive: true });
  const har = {
    log: {
      version: "1.2",
      creator: {
        name: opts.creatorName ?? "mimmobook-e2e",
        version: "1.0.0",
        comment:
          "Manually assembled HAR (Playwright apiRequest contexts do not support recordHar)",
      },
      browser: { name: "playwright-apirequest", version: "1" },
      pages: [],
      entries: opts.entries,
    },
  };
  try {
    fs.writeFileSync(opts.harPath, JSON.stringify(har, null, 2), "utf-8");
    const size = fs.statSync(opts.harPath).size;
    // eslint-disable-next-line no-console
    console.log(
      `${opts.logPrefix ?? "[har]"} exported ${opts.entries.length} entries (${size} bytes) at ${opts.harPath}`,
    );
    await opts.testInfo.attach(opts.attachmentName, {
      path: opts.harPath,
      contentType: "application/json",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `${opts.logPrefix ?? "[har]"} failed to write/attach HAR: ${(err as Error)?.message}`,
    );
  }
}

export interface PublicBookingResult {
  status: number;
  body: any;
  diagnostic: Record<string, any>;
  errorShapeProblems: string[];
  correlationId: string;
  attemptCorrelationId: string;
}

export interface CallPublicBookingOptions {
  request: APIRequestContext;
  body: Record<string, unknown>;
  /** Short label used in logs/correlation-ids/HAR attachment filenames. */
  label: string;
  /** Optional collector array; populated with one HAR entry per attempt. */
  harEntries?: HarEntry[];
  /** Optional umbrella correlation id (e.g. per-test flow id). */
  parentCorrelationId?: string;
  /** Console log prefix (defaults to `[public-booking]`). */
  logPrefix?: string;
}

/**
 * Call the `public-booking` edge function with retries, correlation-id
 * propagation, HAR capture, and rich failure diagnostics.
 */
export async function callPublicBooking(
  opts: CallPublicBookingOptions,
): Promise<PublicBookingResult> {
  const { request, body, label, harEntries, parentCorrelationId } = opts;
  const logPrefix = opts.logPrefix ?? "[public-booking]";
  const url = `${SUPABASE_URL}/functions/v1/public-booking`;

  const correlationId =
    globalThis.crypto?.randomUUID?.() ??
    `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const fullCorrelationId = parentCorrelationId
    ? `${parentCorrelationId}/${label}/${correlationId}`
    : `${label}/${correlationId}`;

  let lastError: unknown = null;
  let res: APIResponse | null = null;
  let durationMs = 0;
  let startedAt = Date.now();
  let attemptCorrelationId = fullCorrelationId;
  let wireHeaders: Record<string, string> = {};
  let redactedHeaders: Record<string, string> = {};

  for (let attempt = 1; attempt <= PUBLIC_BOOKING_MAX_ATTEMPTS; attempt++) {
    startedAt = Date.now();
    attemptCorrelationId = `${fullCorrelationId}/attempt-${attempt}`;
    wireHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "x-correlation-id": attemptCorrelationId,
      "x-request-id": attemptCorrelationId,
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
        `${logPrefix} ${label} attempt ${attempt}/${PUBLIC_BOOKING_MAX_ATTEMPTS} threw after ${durationMs}ms (correlation_id=${attemptCorrelationId}): ${(err as Error)?.message ?? err}`,
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
  const echoedCorrelationId =
    responseHeaders["x-correlation-id"] ??
    responseHeaders["x-request-id"] ??
    null;

  const errorShapeProblems =
    status >= 400 ? validatePublicBookingErrorShape(json ?? text) : [];

  const diagnostic = {
    label,
    correlationId: fullCorrelationId,
    attemptCorrelationId,
    echoedCorrelationId,
    traceIds,
    errorShapeProblems,
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
      `\n${logPrefix} ${label} FAILED (HTTP ${status}, ${durationMs}ms)\n` +
        `${logPrefix} ${label} edge-function trace: ${traceLine}\n` +
        `${logPrefix} grep edge logs with: supabase functions logs public-booking | grep -E '${attemptCorrelationId}|${traceIds.sb_request_id ?? "<sb-request-id>"}'\n` +
        JSON.stringify(diagnostic, null, 2) +
        "\n",
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `${logPrefix} ${label} OK (HTTP ${status}, ${durationMs}ms) trace: ${traceLine}`,
    );
  }

  try {
    await test.info().attach(`public-booking-${label}-${status}.json`, {
      body: Buffer.from(JSON.stringify(diagnostic, null, 2), "utf-8"),
      contentType: "application/json",
    });
  } catch {
    /* test.info() unavailable outside test scope */
  }

  return {
    status,
    body: json ?? text,
    diagnostic,
    errorShapeProblems,
    correlationId: fullCorrelationId,
    attemptCorrelationId,
  };
}
