/**
 * Resource availability resolver.
 *
 * Pure, side-effect-free function that combines a resource's weekly recurring
 * opening hours (`resource_opening_hours`) with one-off occasional working
 * slots (`resource_availability_slots`) for a given date, then subtracts any
 * blocks (`blocked_slots`) that apply to that date.
 *
 * Kept deliberately free of any Supabase / network / DOM dependency so it can
 * be unit-tested in isolation and reused from both the public booking page
 * and the staff calendar.
 *
 * Timezone handling: all date/time strings are interpreted in the *resource's
 * effective timezone* upstream (see `src/lib/timezone.ts`). This function
 * does not perform any timezone conversion itself — callers must already
 * have computed the wall-clock date string in the correct zone.
 */

export interface WeeklyOpening {
  /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday — matches `tzDayOfWeek`. */
  day_of_week: number;
  /** `HH:mm` or `HH:mm:ss`. */
  open_time: string;
  /** `HH:mm` or `HH:mm:ss`. */
  close_time: string;
  /** When true, this weekday is closed regardless of times. */
  is_closed: boolean;
}

export interface OccasionalSlot {
  /** `yyyy-MM-dd`. */
  slot_date: string;
  /** `HH:mm` or `HH:mm:ss`. */
  start_time: string;
  /** `HH:mm` or `HH:mm:ss`. */
  end_time: string;
}

export interface BlockedRange {
  /** `yyyy-MM-dd`. */
  date: string;
  /** `HH:mm` or `HH:mm:ss`. May be null for full-day blocks. */
  start_time: string | null;
  /** `HH:mm` or `HH:mm:ss`. May be null for full-day blocks. */
  end_time: string | null;
}

export interface TimeWindow {
  /** `HH:mm`. */
  start: string;
  /** `HH:mm`. */
  end: string;
}

export interface ResolveInput {
  /** `yyyy-MM-dd`, already evaluated in the resource's effective timezone. */
  date: string;
  /** Day-of-week index for `date` (Sunday = 0), pre-computed by the caller. */
  dayOfWeek: number;
  weeklyHours: WeeklyOpening[];
  occasionalSlots: OccasionalSlot[];
  blocks: BlockedRange[];
}

/** Strip seconds: "09:30:00" -> "09:30". Accepts already-trimmed input. */
const trim = (s: string): string => (s.length >= 5 ? s.slice(0, 5) : s);

const toMin = (s: string): number => {
  const [h, m] = trim(s).split(":").map(Number);
  return h * 60 + m;
};

const fromMin = (n: number): string =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

interface Interval {
  start: number;
  end: number;
}

/** Merge overlapping or touching intervals. */
const mergeIntervals = (input: Interval[]): Interval[] => {
  if (input.length === 0) return [];
  const sorted = [...input].sort((a, b) => a.start - b.start);
  const out: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
};

/** Subtract a single block from a list of intervals. */
const subtractOne = (intervals: Interval[], block: Interval): Interval[] => {
  const out: Interval[] = [];
  for (const iv of intervals) {
    if (block.end <= iv.start || block.start >= iv.end) {
      out.push(iv);
      continue;
    }
    if (block.start > iv.start) out.push({ start: iv.start, end: block.start });
    if (block.end < iv.end) out.push({ start: block.end, end: iv.end });
  }
  return out;
};

/**
 * Resolve the bookable time windows for a resource on a single date.
 *
 * Algorithm:
 *   1. Take every weekly opening matching `dayOfWeek` (skipping closed rows).
 *   2. Add every occasional slot whose `slot_date` matches `date`.
 *   3. Merge overlapping intervals so adjacent windows collapse.
 *   4. Subtract every block that applies to `date` — null start/end means
 *      "full day", which removes everything.
 *
 * Returns an empty list when the resource is unavailable for the whole day.
 */
export const resolveResourceAvailability = (input: ResolveInput): TimeWindow[] => {
  const { date, dayOfWeek, weeklyHours, occasionalSlots, blocks } = input;

  const ivs: Interval[] = [];

  for (const w of weeklyHours) {
    if (w.day_of_week !== dayOfWeek) continue;
    if (w.is_closed) continue;
    const start = toMin(w.open_time);
    const end = toMin(w.close_time);
    if (end > start) ivs.push({ start, end });
  }

  for (const s of occasionalSlots) {
    if (s.slot_date !== date) continue;
    const start = toMin(s.start_time);
    const end = toMin(s.end_time);
    if (end > start) ivs.push({ start, end });
  }

  let merged = mergeIntervals(ivs);

  for (const b of blocks) {
    if (b.date !== date) continue;
    if (b.start_time == null || b.end_time == null) {
      // Full-day block.
      return [];
    }
    merged = subtractOne(merged, {
      start: toMin(b.start_time),
      end: toMin(b.end_time),
    });
  }

  return merged
    .filter((iv) => iv.end > iv.start)
    .map((iv) => ({ start: fromMin(iv.start), end: fromMin(iv.end) }));
};
