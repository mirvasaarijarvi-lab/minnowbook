/**
 * Timezone helpers for resource availability.
 *
 * Single source of truth for "what timezone is this resource scheduling
 * happening in?". The fallback chain is:
 *
 *   resource.timezone -> tenant_settings.timezone -> DEFAULT_TIMEZONE
 *
 * All helpers use the platform `Intl` APIs so no new dependency is required.
 *
 * Date/time strings interchange with the database in their naïve forms:
 *   - dates as `yyyy-MM-dd`
 *   - times as `HH:mm` or `HH:mm:ss`
 * These are interpreted in the effective timezone by the application, exactly
 * the same way `resource_opening_hours` rows have always been interpreted.
 */
export const DEFAULT_TIMEZONE = "Europe/Helsinki";

export interface EffectiveTimezoneInput {
  resourceTz?: string | null;
  tenantTz?: string | null;
}

export type TimezoneSource = "resource" | "tenant" | "default";

export interface EffectiveTimezone {
  tz: string;
  source: TimezoneSource;
}

/** Resolve the effective IANA timezone for a resource. */
export const getEffectiveTimezone = ({
  resourceTz,
  tenantTz,
}: EffectiveTimezoneInput): EffectiveTimezone => {
  const r = (resourceTz ?? "").trim();
  if (r) return { tz: r, source: "resource" };
  const t = (tenantTz ?? "").trim();
  if (t) return { tz: t, source: "tenant" };
  return { tz: DEFAULT_TIMEZONE, source: "default" };
};

/** Validate an IANA timezone name without throwing. */
export const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** List of IANA timezones available on this runtime (best-effort). */
export const listSupportedTimezones = (): string[] => {
  // `Intl.supportedValuesOf` is available in modern browsers and Node 18+.
  // Fall back to a tiny curated list so the UI never breaks.
  const intlAny = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  if (typeof intlAny.supportedValuesOf === "function") {
    try {
      return intlAny.supportedValuesOf("timeZone");
    } catch {
      // fall through
    }
  }
  return [
    "Europe/Helsinki",
    "Europe/Stockholm",
    "Europe/Oslo",
    "Europe/Copenhagen",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "UTC",
  ];
};

const partsOf = (date: Date, tz: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    second: get("second"),
    weekday: get("weekday"), // Mon, Tue...
  };
};

/** Today's date in `yyyy-MM-dd`, evaluated in `tz`. */
export const tzToday = (tz: string, now: Date = new Date()): string => {
  const p = partsOf(now, tz);
  return `${p.year}-${p.month}-${p.day}`;
};

/** `{ date, time }` (yyyy-MM-dd, HH:mm) for "right now" in `tz`. */
export const tzNow = (tz: string, now: Date = new Date()): { date: string; time: string } => {
  const p = partsOf(now, tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Day-of-week (Sunday = 0) for an ISO date string, evaluated in `tz`. */
export const tzDayOfWeek = (isoDate: string, tz: string): number => {
  // Anchor at noon to avoid DST edge effects shifting the wall-clock day.
  const anchor = new Date(`${isoDate}T12:00:00Z`);
  const { weekday } = partsOf(anchor, tz);
  return WEEKDAY_INDEX[weekday] ?? new Date(`${isoDate}T12:00:00Z`).getUTCDay();
};
