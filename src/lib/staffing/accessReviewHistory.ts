/**
 * Builds a per-location history of accepted access reviews. For each review
 * it lists what changed afterward: people added or removed compared with the
 * next review (or with today's access for the newest review), plus the
 * change requests handled in that time.
 */

export type AccessSnapshot = { users: string[]; staff: string[] };

export type ReviewRow = {
  id: string;
  site_id: string;
  snapshot: unknown;
  accepted_by: string;
  accepted_at: string;
};

export type ResolvedRequest = {
  id: string;
  site_id: string;
  subject_name: string;
  note: string;
  status: string;
  resolved_at: string | null;
};

export type AccessChange = {
  id: string;
  action: string;
  subject_id: string;
  subject_name: string;
  old_site_id: string | null;
  new_site_id: string | null;
  old_site_ids?: string[] | null;
  new_site_ids?: string[] | null;
  changed_by: string | null;
  changed_at: string;
};

/** A change matters to a location when it touches it or "all locations". */
export function changeAffectsSite(c: AccessChange, siteId: string): boolean {
  if (c.action === "staff_moved" && (c.old_site_ids || c.new_site_ids)) {
    const hit = (ids: string[] | null | undefined) =>
      !ids || ids.length === 0 || ids.includes(siteId);
    return hit(c.old_site_ids) || hit(c.new_site_ids);
  }
  if (c.action === "staff_moved")
    return (
      c.old_site_id === siteId ||
      c.new_site_id === siteId ||
      c.old_site_id === null ||
      c.new_site_id === null
    );
  return c.old_site_id === siteId || c.new_site_id === siteId;
}

export type HistoryEntry = {
  review: ReviewRow;
  /** Accepted time of the next review, or null when compared with now. */
  untilAt: string | null;
  usersAdded: string[];
  usersRemoved: string[];
  staffAdded: string[];
  staffRemoved: string[];
  requests: ResolvedRequest[];
  /** Recorded location assignment changes in this period, oldest first. */
  changes: AccessChange[];
};

export function readSnapshot(raw: unknown): AccessSnapshot {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return { users: arr(o.users), staff: arr(o.staff) };
}

const minus = (a: string[], b: string[]) => {
  const s = new Set(b);
  return a.filter((x) => !s.has(x));
};

export function buildSiteHistory(
  siteId: string,
  reviews: ReviewRow[],
  current: AccessSnapshot,
  requests: ResolvedRequest[],
  changes: AccessChange[] = [],
): HistoryEntry[] {
  const mine = reviews
    .filter((r) => r.site_id === siteId)
    .sort((a, b) => b.accepted_at.localeCompare(a.accepted_at));
  return mine.map((review, i) => {
    const newer = i > 0 ? mine[i - 1] : null;
    const before = readSnapshot(review.snapshot);
    const after = newer ? readSnapshot(newer.snapshot) : current;
    const from = review.accepted_at;
    const until = newer?.accepted_at ?? null;
    return {
      review,
      untilAt: until,
      usersAdded: minus(after.users, before.users),
      usersRemoved: minus(before.users, after.users),
      staffAdded: minus(after.staff, before.staff),
      staffRemoved: minus(before.staff, after.staff),
      requests: requests.filter(
        (r) =>
          r.site_id === siteId &&
          !!r.resolved_at &&
          r.resolved_at > from &&
          (until === null || r.resolved_at <= until),
      ),
      changes: changes
        .filter(
          (c) =>
            changeAffectsSite(c, siteId) &&
            c.changed_at > from &&
            (until === null || c.changed_at <= until),
        )
        .sort((a, b) => a.changed_at.localeCompare(b.changed_at)),
    };
  });
}
