// Retry de-duplication rules for the public booking endpoint.
//
// A guest's browser can re-send the very same booking (double click, refresh
// mid-submit, automatic network retry). Such a retry must not create a second
// reservation. But "the same booking" has to mean EVERY field a guest can
// vary: otherwise two hotel rooms for the same nights, or a second table for
// the same evening, collapse into one row and staff never see the missing
// booking.
//
// The rules live here, isolated from the handler, so they can be unit tested
// without a database and so both the query builder and any comparison logic
// use one single definition.

/** How long after a booking a byte-identical repeat counts as a retry. */
export const RETRY_WINDOW_MINUTES = 15;

/** Fields a guest can vary that MUST all match for a repeat to be a retry. */
export interface DedupFields {
  start_time?: unknown;
  room_type?: unknown;
  check_out_date?: unknown;
  guests_count?: unknown;
  estimated_guests?: unknown;
  special_requests?: unknown;
}

/**
 * Columns compared in addition to the coarse keys (tenant, guest email,
 * reservation type, date, status, created_at window).
 *
 * EVERY entry must be a real column on `public.reservations`. A name that does
 * not exist makes PostgREST reject the whole lookup, the handler logs a
 * warning and skips de-duplication entirely, and double-clicks start creating
 * duplicate reservations. `resource_id` is deliberately absent: it is a
 * request-only field used to price the booking and is never persisted on the
 * reservation row, so a resource choice can only be compared through the
 * columns it actually writes (room_type, dates, guest count).
 *
 * Order is stable so tests can assert against it.
 */
export const DEDUP_MATCH_COLUMNS = [
  "start_time",
  "room_type",
  "check_out_date",
  "guests_count",
  "estimated_guests",
  "special_requests",
] as const;

export type DedupMatchColumn = typeof DEDUP_MATCH_COLUMNS[number];

/** A single equality filter. `value === null` means "IS NULL". */
export interface DedupFilter {
  column: DedupMatchColumn;
  value: unknown | null;
}

/** Normalize undefined to null so absent and explicitly-null behave alike. */
function normalize(value: unknown): unknown | null {
  return value === undefined || value === null ? null : value;
}

/** Build the per-field filters for the dedup lookup. */
export function buildDedupFilters(fields: DedupFields): DedupFilter[] {
  return DEDUP_MATCH_COLUMNS.map((column) => ({
    column,
    value: normalize((fields as Record<string, unknown>)[column]),
  }));
}

/** Minimal shape of the PostgREST filter builder used here. */
export interface DedupQuery<Q> {
  eq(column: string, value: never): Q;
  is(column: string, value: null): Q;
}

/**
 * Apply every dedup filter to a PostgREST query, using `is(col, null)` for
 * empty values because SQL `= NULL` never matches.
 */
export function applyDedupFilters<Q extends DedupQuery<Q>>(
  query: Q,
  fields: DedupFields,
): Q {
  let next = query;
  for (const { column, value } of buildDedupFilters(fields)) {
    next = value === null ? next.is(column, null) : next.eq(column, value as never);
  }
  return next;
}

/**
 * True only when two bookings are identical across every guest-variable
 * field that the reservation row records.
 */
export function isSameBooking(a: DedupFields, b: DedupFields): boolean {
  return DEDUP_MATCH_COLUMNS.every((column) =>
    normalize((a as Record<string, unknown>)[column]) ===
      normalize((b as Record<string, unknown>)[column])
  );
}
