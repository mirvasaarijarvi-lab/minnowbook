/**
 * Access review reminders. Worked out from each location's last accepted
 * review when the page loads; nothing is stored or scheduled.
 */

export type ReviewDueState = "ok" | "dueSoon" | "overdue" | "never";

export interface ReviewDue {
  state: ReviewDueState;
  /** When the next review is (or was) due; null if never reviewed. */
  dueAt: Date | null;
  /** Whole days past the due date (0 unless overdue). */
  daysOverdue: number;
}

/** Reminders start this many days before the due date. */
export const DUE_SOON_DAYS = 14;

const DAY = 86_400_000;

export function reviewDue(
  lastAcceptedAt: string | null | undefined,
  intervalDays: number,
  now: Date = new Date(),
): ReviewDue {
  if (!lastAcceptedAt) return { state: "never", dueAt: null, daysOverdue: 0 };
  const last = new Date(lastAcceptedAt);
  if (Number.isNaN(last.getTime()))
    return { state: "never", dueAt: null, daysOverdue: 0 };
  const dueAt = new Date(last.getTime() + intervalDays * DAY);
  const diff = dueAt.getTime() - now.getTime();
  if (diff < 0)
    return {
      state: "overdue",
      dueAt,
      daysOverdue: Math.floor(-diff / DAY),
    };
  if (diff <= DUE_SOON_DAYS * DAY) return { state: "dueSoon", dueAt, daysOverdue: 0 };
  return { state: "ok", dueAt, daysOverdue: 0 };
}

export interface SiteReminder {
  siteId: string;
  siteName: string;
  due: ReviewDue;
}

/**
 * Locations that need attention, most urgent first: overdue (longest first),
 * then never reviewed, then due soon (soonest first).
 */
export function reviewReminders(
  sites: { id: string; name: string }[],
  reviews: { site_id: string; accepted_at: string }[],
  intervalDays: number,
  now: Date = new Date(),
): SiteReminder[] {
  const latest = new Map<string, string>();
  for (const r of reviews) {
    const cur = latest.get(r.site_id);
    if (!cur || r.accepted_at > cur) latest.set(r.site_id, r.accepted_at);
  }
  const rank: Record<ReviewDueState, number> = {
    overdue: 0,
    never: 1,
    dueSoon: 2,
    ok: 3,
  };
  return sites
    .map((s) => ({
      siteId: s.id,
      siteName: s.name,
      due: reviewDue(latest.get(s.id), intervalDays, now),
    }))
    .filter((r) => r.due.state !== "ok")
    .sort(
      (a, b) =>
        rank[a.due.state] - rank[b.due.state] ||
        b.due.daysOverdue - a.due.daysOverdue ||
        (a.due.dueAt?.getTime() ?? 0) - (b.due.dueAt?.getTime() ?? 0) ||
        a.siteName.localeCompare(b.siteName),
    );
}
