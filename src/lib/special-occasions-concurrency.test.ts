/**
 * Seat-limit rules under concurrency.
 *
 * Two things are proven here:
 *  1. Seat accounting is exact when bookings are counted one after another,
 *     for both fixed sittings (per sitting) and open booking (per day).
 *  2. Independent requests that each validate against the same pre-booking
 *     snapshot can all pass, which is why the database also holds a row lock
 *     and recounts seats before an occasion booking is stored
 *     (trigger `enforce_special_occasion_capacity`).
 */
import { describe, it, expect } from "vitest";
import {
  validateOccasionBooking,
  remainingSeats,
  seatingAvailability,
  type OccasionBookingLike,
  type SpecialOccasionLike,
} from "../../supabase/functions/_shared/special-occasions";

const DATE = "2026-12-24";

const seatingsOccasion: SpecialOccasionLike = {
  id: "occ-seatings",
  occasion_date: DATE,
  reservation_type: "restaurant",
  capacity: 4,
  booking_type: "seatings",
  seating_times: ["17:00", "20:00"],
  is_active: true,
};

const openOccasion: SpecialOccasionLike = {
  id: "occ-open",
  occasion_date: DATE,
  reservation_type: "restaurant",
  capacity: 5,
  booking_type: "open",
  seating_times: [],
  is_active: true,
};

/** Requests arriving together, each validated against the same snapshot. */
function validateAgainstSnapshot(
  occasion: SpecialOccasionLike,
  snapshot: OccasionBookingLike[],
  requests: Array<{ startTime?: string | null; guests: number }>,
) {
  return requests.map((request) =>
    validateOccasionBooking({
      occasion,
      date: DATE,
      reservationType: "restaurant",
      startTime: request.startTime ?? null,
      guests: request.guests,
      bookings: snapshot,
    }),
  );
}

/** Requests handled one at a time, each seeing everything stored before it. */
function validateSerialized(
  occasion: SpecialOccasionLike,
  requests: Array<{ startTime?: string | null; guests: number }>,
) {
  const stored: OccasionBookingLike[] = [];
  return requests.map((request) => {
    const check = validateOccasionBooking({
      occasion,
      date: DATE,
      reservationType: "restaurant",
      startTime: request.startTime ?? null,
      guests: request.guests,
      bookings: stored,
    });
    if (check.ok) {
      stored.push({
        start_time: check.seating,
        guests_count: request.guests,
        status: "confirmed",
      });
    }
    return { check, stored: [...stored] };
  });
}

function seatsStored(bookings: OccasionBookingLike[], startTime?: string | null): number {
  return bookings
    .filter((b) => (startTime === undefined ? true : b.start_time === startTime))
    .filter((b) => (b.status ?? "") !== "cancelled")
    .reduce((sum, b) => sum + (b.guests_count ?? 1), 0);
}

describe("special occasions: seat limits when bookings arrive one after another", () => {
  it("never lets a fixed sitting exceed its own capacity", () => {
    const results = validateSerialized(seatingsOccasion, [
      { startTime: "17:00", guests: 2 },
      { startTime: "17:00", guests: 2 },
      { startTime: "17:00", guests: 1 },
      { startTime: "17:00", guests: 1 },
    ]);
    expect(results.map((r) => r.check.ok)).toEqual([true, true, false, false]);
    const final = results[results.length - 1].stored;
    expect(seatsStored(final, "17:00")).toBe(4);
  });

  it("keeps the other sitting bookable when one sitting fills up", () => {
    const results = validateSerialized(seatingsOccasion, [
      { startTime: "17:00", guests: 4 },
      { startTime: "17:00", guests: 1 },
      { startTime: "20:00", guests: 4 },
      { startTime: "20:00", guests: 1 },
    ]);
    expect(results.map((r) => r.check.ok)).toEqual([true, false, true, false]);
    const final = results[results.length - 1].stored;
    expect(seatsStored(final, "17:00")).toBe(4);
    expect(seatsStored(final, "20:00")).toBe(4);
    expect(seatsStored(final)).toBe(8);
  });

  it("counts open-booking seats across the whole day, whatever the time", () => {
    const results = validateSerialized(openOccasion, [
      { startTime: "12:00", guests: 2 },
      { startTime: "18:30", guests: 2 },
      { startTime: "20:00", guests: 2 },
      { startTime: "21:00", guests: 1 },
    ]);
    expect(results.map((r) => r.check.ok)).toEqual([true, true, false, true]);
    expect(seatsStored(results[results.length - 1].stored)).toBe(5);
  });

  it("reports the seats actually left with every refusal", () => {
    const results = validateSerialized(openOccasion, [
      { startTime: "12:00", guests: 4 },
      { startTime: "13:00", guests: 3 },
    ]);
    const refusal = results[1].check as { ok: boolean; reason?: string; remaining?: number };
    expect(refusal.ok).toBe(false);
    expect(refusal.reason).toBe("FULL");
    expect(refusal.remaining).toBe(1);
  });

  it("frees seats again when an earlier booking is cancelled", () => {
    const stored: OccasionBookingLike[] = [
      { start_time: "17:00", guests_count: 4, status: "cancelled" },
    ];
    expect(remainingSeats(seatingsOccasion, stored, "17:00")).toBe(4);
    const check = validateOccasionBooking({
      occasion: seatingsOccasion,
      date: DATE,
      reservationType: "restaurant",
      startTime: "17:00",
      guests: 4,
      bookings: stored,
    });
    expect(check.ok).toBe(true);
  });
});

describe("special occasions: simultaneous requests need the database seat guard", () => {
  it("lets two requests validated against the same snapshot both pass, which would oversell", () => {
    const snapshot: OccasionBookingLike[] = [
      { start_time: "17:00", guests_count: 3, status: "confirmed" },
    ];
    const results = validateAgainstSnapshot(seatingsOccasion, snapshot, [
      { startTime: "17:00", guests: 1 },
      { startTime: "17:00", guests: 1 },
    ]);
    // Each request sees 1 seat left, so both pass the in-memory rules.
    expect(results.every((r) => r.ok)).toBe(true);
    // Stored together they would be 5 seats in a 4-seat sitting, so the final
    // word has to come from the database trigger that locks the occasion row.
    expect(3 + 1 + 1).toBeGreaterThan(seatingsOccasion.capacity);
  });

  it("does the same for open booking across different times of day", () => {
    const snapshot: OccasionBookingLike[] = [
      { start_time: "12:00", guests_count: 4, status: "confirmed" },
    ];
    const results = validateAgainstSnapshot(openOccasion, snapshot, [
      { startTime: "18:00", guests: 1 },
      { startTime: "20:00", guests: 1 },
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(4 + 1 + 1).toBeGreaterThan(openOccasion.capacity);
  });

  it("refuses every simultaneous request once the snapshot is already full", () => {
    const snapshot: OccasionBookingLike[] = [
      { start_time: "17:00", guests_count: 4, status: "confirmed" },
    ];
    const results = validateAgainstSnapshot(seatingsOccasion, snapshot, [
      { startTime: "17:00", guests: 1 },
      { startTime: "17:00", guests: 2 },
      { startTime: "17:00", guests: 4 },
    ]);
    expect(results.every((r) => !r.ok)).toBe(true);
    for (const result of results) {
      if (!result.ok) expect(result.reason).toBe("FULL");
    }
  });

  it("shows the sitting availability a booking page would render mid-fill", () => {
    const snapshot: OccasionBookingLike[] = [
      { start_time: "17:00", guests_count: 4, status: "confirmed" },
      { start_time: "20:00", guests_count: 1, status: "confirmed" },
    ];
    expect(seatingAvailability(seatingsOccasion, snapshot)).toEqual([
      { time: "17:00", taken: 4, remaining: 0, full: true },
      { time: "20:00", taken: 1, remaining: 3, full: false },
    ]);
  });
});
