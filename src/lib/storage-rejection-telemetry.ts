/**
 * Wires the storage-path rejection logger to the
 * `report-storage-rejection` edge function so spikes can be detected
 * server-side. Falls back to console.warn on any transport failure
 * so local dev (no Supabase reachable) still surfaces rejections.
 *
 * SAFETY:
 *   - The payload is the same safe-shape event the local logger
 *     receives. The raw rejected path is NEVER serialised here, the
 *     storage-path module never put it in the event.
 *   - Calls are fire-and-forget. Network failure must NEVER throw
 *     into the calling page (uploads, signed-URL helpers, etc.).
 *   - Throttled per-process to avoid hammering the edge function in
 *     the unlikely event of a render loop that keeps rejecting.
 */
import {
  setRejectedStoragePathLogger,
  type RejectedStoragePathEvent,
} from "@/lib/storage-path";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-storage-rejection`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Throttle: at most N events per rolling window, to absorb runaway
// caller bugs without a backpressure storm. The server-side spike
// detector still sees enough volume to trip on any real attack.
const MAX_EVENTS_PER_WINDOW = 30;
const WINDOW_MS = 10_000;
let windowStart = 0;
let windowCount = 0;

function shouldForward(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= MAX_EVENTS_PER_WINDOW) return false;
  windowCount++;
  return true;
}

function forward(event: RejectedStoragePathEvent): void {
  // Mirror the shape exactly. We rebuild the object instead of
  // forwarding the original reference so we never accidentally pick
  // up a future field that hasn't been audited as PII-safe.
  const body = JSON.stringify({
    reason: event.reason,
    inputType: event.inputType,
    inputLength: event.inputLength,
    segmentCount: event.segmentCount,
    leadingCharClass: event.leadingCharClass,
    hasSchemeShape: event.hasSchemeShape,
    hasBackslash: event.hasBackslash,
    hasControlChar: event.hasControlChar,
    callsite: event.callsite,
    tenantId: event.tenantId,
  });

  // Prefer sendBeacon when the page is unloading so the event still
  // ships during navigations. Fall back to fetch with keepalive.
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // Ignore, fall through to fetch.
  }

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Edge function is public (verify_jwt = false in defaults)
        // but we still send the publishable key so platform-level
        // request gating treats it as a known client.
        apikey: ANON_KEY,
      },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {
      // Swallow. Logging here would risk feedback loops.
    });
  } catch {
    // Same: never let telemetry break the calling page.
  }
}

let installed = false;

/**
 * Install the production logger. Idempotent. Safe to call from any
 * top-level entry point (main.tsx, app boot, tests).
 */
export function installStorageRejectionTelemetry(): void {
  if (installed) return;
  installed = true;
  setRejectedStoragePathLogger((event) => {
    // Always keep the local console line so dev / Sentry breadcrumbs
    // still see the rejection.
    // eslint-disable-next-line no-console
    console.warn("[security] storage-path rejected", event);
    if (!ENDPOINT || !ANON_KEY) return;
    if (!shouldForward()) return;
    forward(event);
  });
}
