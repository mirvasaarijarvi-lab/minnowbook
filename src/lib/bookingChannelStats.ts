/**
 * Pure helpers for the "where bookings come from" report.
 *
 * MimmoBook has no explicit channel column: reservations created through the
 * public booking edge function leave `created_by` NULL, while staff-created
 * rows carry the acting user's id. That distinction is the channel signal.
 */
import {
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isSameMonth,
  isSameWeek,
  parseISO,
} from "date-fns";
import type { Locale } from "date-fns";

export type Channel = "public" | "staff";

export interface ChannelRow {
  date: string;
  reservation_type: string;
  created_by?: string | null;
}

export function resolveChannel(row: ChannelRow): Channel {
  return row.created_by ? "staff" : "public";
}

export interface ChannelSplit {
  total: number;
  publicCount: number;
  staffCount: number;
  /** Whole-number percentages that add up to 100 when total > 0. */
  publicPct: number;
  staffPct: number;
}

export function computeChannelSplit(rows: ChannelRow[]): ChannelSplit {
  const total = rows.length;
  const publicCount = rows.filter((r) => resolveChannel(r) === "public").length;
  const staffCount = total - publicCount;
  if (total === 0)
    return {
      total: 0,
      publicCount: 0,
      staffCount: 0,
      publicPct: 0,
      staffPct: 0,
    };
  const publicPct = Math.round((publicCount / total) * 100);
  return {
    total,
    publicCount,
    staffCount,
    publicPct,
    staffPct: 100 - publicPct,
  };
}

/** Channel split per service type plus an "all" roll-up. */
export function computeChannelSplitByType(
  rows: ChannelRow[],
  types: string[],
): Record<string, ChannelSplit> {
  const out: Record<string, ChannelSplit> = { all: computeChannelSplit(rows) };
  for (const type of types) {
    out[type] = computeChannelSplit(
      rows.filter((r) => r.reservation_type === type),
    );
  }
  return out;
}

export interface TrendBucket {
  label: string;
  publicCount: number;
  staffCount: number;
}

/**
 * Buckets rows by week (<= ~120 days) or month, keeping the two channels apart
 * so the chart can show whether the public page is growing.
 */
export function buildTrendBuckets(opts: {
  rows: ChannelRow[];
  start: Date;
  end: Date;
  dateLocale: Locale;
  granularity: "week" | "month";
}): TrendBucket[] {
  const { rows, start, end, dateLocale, granularity } = opts;
  const dayOf = (r: ChannelRow) => parseISO(`${r.date}T00:00:00`);

  const summarize = (items: ChannelRow[]) => ({
    publicCount: items.filter((r) => resolveChannel(r) === "public").length,
    staffCount: items.filter((r) => resolveChannel(r) === "staff").length,
  });

  if (granularity === "week") {
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(
      (weekStart) => ({
        label: format(weekStart, "d.M.", { locale: dateLocale }),
        ...summarize(
          rows.filter((r) =>
            isSameWeek(dayOf(r), weekStart, { weekStartsOn: 1 }),
          ),
        ),
      }),
    );
  }
  return eachMonthOfInterval({ start, end }).map((monthStart) => ({
    label: format(monthStart, "LLL", { locale: dateLocale }),
    ...summarize(rows.filter((r) => isSameMonth(dayOf(r), monthStart))),
  }));
}
