// Tenant-local clock helpers.
//
// Scheduled mails are gated on the tenant's own wall clock so they land at the
// same local hour all year, instead of drifting when daylight saving shifts.

export const DEFAULT_TIMEZONE = "Europe/Helsinki";

/** Tenant timezones come from settings, so fall back when they are unusable. */
export function normalizeTimezone(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_TIMEZONE;
  const tz = raw.trim();
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Wall-clock parts for `now` as seen inside `timeZone`. */
export function localParts(
  now: Date,
  timeZone: string,
): { date: string; hour: number; weekday: number } {
  const tz = normalizeTimezone(timeZone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { date, hour: Number(get("hour")), weekday };
}

/** Local hour of the tenant, used to gate an hourly cron down to one send. */
export function tenantLocalHour(now: Date, timeZone: unknown): number {
  return localParts(now, normalizeTimezone(timeZone)).hour;
}

/** Local weekday of the tenant, 0 = Sunday. */
export function tenantLocalWeekday(now: Date, timeZone: unknown): number {
  return localParts(now, normalizeTimezone(timeZone)).weekday;
}

/** Local calendar date of the tenant in ISO form. */
export function tenantLocalDate(now: Date, timeZone: unknown): string {
  return localParts(now, normalizeTimezone(timeZone)).date;
}

/** ISO date `days` after `isoDate`, calendar arithmetic only. */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
