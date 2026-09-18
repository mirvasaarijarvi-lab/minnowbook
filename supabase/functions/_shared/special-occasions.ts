/**
 * Special occasions (staff-defined event days such as Mother's Day lunch or a
 * Christmas dinner) shared rules.
 *
 * This module is intentionally pure so both the public booking page and the
 * `public-booking` edge function apply exactly the same capacity and seating
 * rules. No imports, no I/O.
 */

export type OccasionBookingType = "seatings" | "open";

export interface SpecialOccasionLike {
  id: string;
  name?: string | null;
  occasion_date: string;
  reservation_type: string;
  resource_id?: string | null;
  capacity: number;
  booking_type: string;
  seating_times?: unknown;
  is_active?: boolean;
}

export interface OccasionBookingLike {
  start_time?: string | null;
  guests_count?: number | null;
  estimated_guests?: number | null;
  status?: string | null;
}

export interface SeatingAvailability {
  time: string;
  taken: number;
  remaining: number;
  full: boolean;
}

export type OccasionRejectionReason =
  | "NOT_FOUND"
  | "INACTIVE"
  | "WRONG_DATE"
  | "WRONG_TYPE"
  | "SEATING_REQUIRED"
  | "INVALID_SEATING"
  | "FULL";

export type OccasionCheck =
  | { ok: true; seating: string | null; remaining: number }
  | { ok: false; reason: OccasionRejectionReason; remaining?: number };

/** Turn any time-ish value into "HH:MM", or null when unusable. */
export function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** Read the stored seating_times JSON into a sorted, de-duplicated "HH:MM" list. */
export function parseSeatingTimes(value: unknown): string[] {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      raw = value.split(",");
    }
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const time = normalizeTime(entry);
    if (time) seen.add(time);
  }
  return Array.from(seen).sort();
}

export function bookingType(occasion: SpecialOccasionLike): OccasionBookingType {
  return occasion.booking_type === "open" ? "open" : "seatings";
}

function guestsOf(booking: OccasionBookingLike): number {
  const count = booking.guests_count ?? booking.estimated_guests ?? 1;
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function counts(booking: OccasionBookingLike): boolean {
  const status = (booking.status ?? "").toLowerCase();
  return status !== "cancelled" && status !== "rejected";
}

/**
 * Seats already taken. For a sittings occasion the capacity is per sitting, so
 * only bookings on the same sitting count; for an open occasion every booking
 * on the day shares one seat pool.
 */
export function seatsTaken(
  occasion: SpecialOccasionLike,
  bookings: OccasionBookingLike[],
  seating?: string | null,
): number {
  const perSeating = bookingType(occasion) === "seatings";
  const target = perSeating ? normalizeTime(seating) : null;
  let total = 0;
  for (const booking of bookings) {
    if (!counts(booking)) continue;
    if (perSeating && normalizeTime(booking.start_time) !== target) continue;
    total += guestsOf(booking);
  }
  return total;
}

export function remainingSeats(
  occasion: SpecialOccasionLike,
  bookings: OccasionBookingLike[],
  seating?: string | null,
): number {
  const capacity = Number.isFinite(occasion.capacity) ? Math.max(0, Math.floor(occasion.capacity)) : 0;
  return Math.max(0, capacity - seatsTaken(occasion, bookings, seating));
}

/** Per-sitting availability, in time order. Empty for an open occasion. */
export function seatingAvailability(
  occasion: SpecialOccasionLike,
  bookings: OccasionBookingLike[],
): SeatingAvailability[] {
  if (bookingType(occasion) === "open") return [];
  return parseSeatingTimes(occasion.seating_times).map((time) => {
    const taken = seatsTaken(occasion, bookings, time);
    const remaining = remainingSeats(occasion, bookings, time);
    return { time, taken, remaining, full: remaining <= 0 };
  });
}

/** First sitting that still fits the party, or null when none does. */
export function findSeatingWithCapacity(
  occasion: SpecialOccasionLike,
  bookings: OccasionBookingLike[],
  guests: number,
): string | null {
  const needed = Math.max(1, Math.floor(Number(guests) || 1));
  for (const slot of seatingAvailability(occasion, bookings)) {
    if (slot.remaining >= needed) return slot.time;
  }
  return null;
}

export interface OccasionBookingRequest {
  occasion: SpecialOccasionLike | null | undefined;
  date: string;
  reservationType?: string | null;
  startTime?: string | null;
  guests?: number | null;
  bookings: OccasionBookingLike[];
}

/**
 * The single decision both the booking page and the edge function make before
 * a guest is allowed onto an occasion.
 */
export function validateOccasionBooking(request: OccasionBookingRequest): OccasionCheck {
  const { occasion, date, reservationType, startTime, bookings } = request;
  if (!occasion) return { ok: false, reason: "NOT_FOUND" };
  if (occasion.is_active === false) return { ok: false, reason: "INACTIVE" };
  if (String(occasion.occasion_date).slice(0, 10) !== String(date).slice(0, 10)) {
    return { ok: false, reason: "WRONG_DATE" };
  }
  if (reservationType && occasion.reservation_type !== reservationType) {
    return { ok: false, reason: "WRONG_TYPE" };
  }

  const guests = Math.max(1, Math.floor(Number(request.guests ?? 1) || 1));

  if (bookingType(occasion) === "open") {
    const remaining = remainingSeats(occasion, bookings);
    if (remaining < guests) return { ok: false, reason: "FULL", remaining };
    return { ok: true, seating: normalizeTime(startTime), remaining };
  }

  const seatings = parseSeatingTimes(occasion.seating_times);
  const seating = normalizeTime(startTime);
  if (!seating) return { ok: false, reason: "SEATING_REQUIRED" };
  if (!seatings.includes(seating)) return { ok: false, reason: "INVALID_SEATING" };
  const remaining = remainingSeats(occasion, bookings, seating);
  if (remaining < guests) return { ok: false, reason: "FULL", remaining };
  return { ok: true, seating, remaining };
}
