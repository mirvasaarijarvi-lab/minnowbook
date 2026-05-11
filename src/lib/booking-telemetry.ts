/**
 * Lightweight, secret-safe telemetry for public booking errors.
 *
 * We deliberately avoid sending any PII, form values, tokens, or raw
 * server messages. Only a stable event name, the machine-readable
 * error_code, and coarse context (tenant slug, resource id, locale,
 * page path) are emitted, so we can track frequency without leaking
 * secrets.
 *
 * Transport order:
 *  1. window.dataLayer.push (Google Tag Manager, already integrated).
 *  2. console.warn fallback so the event is still visible in the
 *     browser console / Lovable preview logs when GTM is absent
 *     (e.g. ad-blocked, dev environment, tests).
 *
 * The function is intentionally fire-and-forget and never throws.
 */

import {
  BOOKING_ERROR_CODES,
  type BookingErrorCode,
} from "../../supabase/functions/_shared/booking-error-codes";

export type BookingTelemetryContext = {
  tenantSlug?: string | null;
  resourceId?: string | null;
  locale?: string | null;
};

export type BookingTelemetryEvent = {
  event: "booking_error";
  error_code: BookingErrorCode | string;
  tenant_slug?: string;
  resource_id?: string;
  locale?: string;
  page_path?: string;
  ts: string;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function safePagePath(): string | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    return window.location?.pathname;
  } catch {
    return undefined;
  }
}

export function buildBookingTelemetryEvent(
  errorCode: BookingErrorCode | string,
  ctx: BookingTelemetryContext = {},
): BookingTelemetryEvent {
  const evt: BookingTelemetryEvent = {
    event: "booking_error",
    error_code: errorCode,
    ts: new Date().toISOString(),
  };
  if (ctx.tenantSlug) evt.tenant_slug = ctx.tenantSlug;
  if (ctx.resourceId) evt.resource_id = ctx.resourceId;
  if (ctx.locale) evt.locale = ctx.locale;
  const path = safePagePath();
  if (path) evt.page_path = path;
  return evt;
}

export function trackBookingError(
  errorCode: BookingErrorCode | string,
  ctx: BookingTelemetryContext = {},
): void {
  try {
    const evt = buildBookingTelemetryEvent(errorCode, ctx);
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(evt);
    }
    // Always log a coarse warning so the signal is visible even
    // when GTM is blocked. Never include the raw Error object or
    // the server message, which could carry stack traces.
    // eslint-disable-next-line no-console
    console.warn("[booking-telemetry]", evt);
  } catch {
    /* never let telemetry break the booking flow */
  }
}

/**
 * Convenience wrapper for the specific case we care about most:
 * the misconfigured backend service-role key. Keeps the call site
 * in PublicBooking.tsx readable.
 */
export function trackServiceRoleKeyMissing(ctx: BookingTelemetryContext = {}): void {
  trackBookingError(BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING, ctx);
}
