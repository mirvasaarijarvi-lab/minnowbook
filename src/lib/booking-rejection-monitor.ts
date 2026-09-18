/**
 * Booking rejection monitoring.
 *
 * The public booking function records every refusal in the validation log with
 * a machine-readable tag, `[error_code:OCCASION_FULL]`. These helpers read
 * those tags back so the dashboard can show how often occasions fill up, how
 * often a sitting is no longer available, and how often a guest picks a date
 * the occasion does not cover.
 *
 * Keep the tag shape in sync with `rejectionTag()` in
 * supabase/functions/public-booking/index.ts.
 */

export const REJECTION_TAG_RE = /\[error_code:([A-Z0-9_]+)\]/;

/** Error codes we surface in the monitoring panel, in display order. */
export const MONITORED_REJECTION_CODES = [
  "OCCASION_FULL",
  "OCCASION_SEATING_UNAVAILABLE",
  "OCCASION_SEATING_REQUIRED",
  "OCCASION_WRONG_DATE",
  "OCCASION_WRONG_TYPE",
  "OCCASION_UNAVAILABLE",
  "DB_INSERT_FAILED",
] as const;

export type MonitoredRejectionCode = (typeof MONITORED_REJECTION_CODES)[number];

export interface RejectionLogRow {
  reasons?: unknown;
  created_at?: string | null;
}

export interface RejectionCount {
  code: string;
  count: number;
  lastSeen: string | null;
}

/** Pull the error code out of a validation-log `reasons` array. */
export function rejectionCodeFromReasons(reasons: unknown): string | null {
  if (!Array.isArray(reasons)) return null;
  for (const entry of reasons) {
    if (typeof entry !== "string") continue;
    const match = REJECTION_TAG_RE.exec(entry);
    if (match) return match[1];
  }
  return null;
}

/**
 * Count rejections per error code, newest occurrence first per code. Rows
 * without a recognisable tag are grouped under `UNTAGGED` so nothing silently
 * disappears from the totals.
 */
export function summarizeRejections(rows: RejectionLogRow[]): RejectionCount[] {
  const byCode = new Map<string, RejectionCount>();
  for (const row of rows ?? []) {
    const code = rejectionCodeFromReasons(row?.reasons) ?? "UNTAGGED";
    const created = typeof row?.created_at === "string" ? row.created_at : null;
    const current = byCode.get(code);
    if (!current) {
      byCode.set(code, { code, count: 1, lastSeen: created });
      continue;
    }
    current.count += 1;
    if (created && (!current.lastSeen || created > current.lastSeen)) {
      current.lastSeen = created;
    }
  }

  const order = new Map<string, number>(
    MONITORED_REJECTION_CODES.map((code, index) => [code, index]),
  );
  return [...byCode.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const ai = order.get(a.code) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(b.code) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.code.localeCompare(b.code);
  });
}

/** Total number of rejections in the given rows. */
export function totalRejections(rows: RejectionLogRow[]): number {
  return (rows ?? []).length;
}
