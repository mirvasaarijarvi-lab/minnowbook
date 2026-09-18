// Edge cases for the special occasion rules: parties larger than the seats
// left, sittings that cannot be booked, and dates with no occasion at all.
import { describe, it, expect } from "vitest";
import {
  findSeatingWithCapacity,
  remainingSeats,
  seatingAvailability,
  validateOccasionBooking,
  type OccasionBookingLike,
  type SpecialOccasionLike,
} from "../../supabase/functions/_shared/special-occasions";

const DATE = "2026-05-10";

const seatings: SpecialOccasionLike = {
  id: "occ-seatings",
  name: "Mother's Day lunch",
  occasion_date: DATE,
  reservation_type: "restaurant",
  capacity: 4,
  booking_type: "seatings",
  seating_times: ["12:00", "15:00"],
  is_active: true,
};

const open: SpecialOccasionLike = {
  ...seatings,
  id: "occ-open",
  booking_type: "open",
  seating_times: [],
  capacity: 6,
};

const book = (
  start_time: string | null,
  guests_count: number,
  status = "pending",
): OccasionBookingLike => ({ start_time, guests_count, status });

describe("over-capacity bookings", () => {
  it("refuses a party larger than the seats left on a sitting", () => {
    const bookings = [book("12:00", 3)];
    const check = validateOccasionBooking({
      occasion: seatings,
      date: DATE,
      reservationType: "restaurant",
      startTime: "12:00",
      guests: 2,
      bookings,
    });
    expect(check).toEqual({ ok: false, reason: "FULL", remaining: 1 });
  });

  it("accepts a party that exactly fills the remaining seats", () => {
    const check = validateOccasionBooking({
      occasion: seatings,
      date: DATE,
      startTime: "12:00",
      guests: 1,
      bookings: [book("12:00", 3)],
    });
    expect(check).toEqual({ ok: true, seating: "12:00", remaining: 1 });
  });

  it("refuses a single party bigger than the whole occasion", () => {
    const check = validateOccasionBooking({
      occasion: open,
      date: DATE,
      guests: 12,
      startTime: "18:00",
      bookings: [],
    });
    expect(check).toEqual({ ok: false, reason: "FULL", remaining: 6 });
  });

  it("counts every booking of the day against an open occasion", () => {
    const bookings = [book("12:00", 2), book("17:30", 3), book(null, 1)];
    expect(remainingSeats(open, bookings)).toBe(0);
    expect(
      validateOccasionBooking({
        occasion: open,
        date: DATE,
        guests: 1,
        bookings,
        startTime: "19:00",
      }),
    ).toEqual({ ok: false, reason: "FULL", remaining: 0 });
  });

  it("frees seats again when a booking is cancelled or rejected", () => {
    const bookings = [
      book("12:00", 4, "cancelled"),
      book("12:00", 1, "rejected"),
    ];
    expect(remainingSeats(seatings, bookings, "12:00")).toBe(4);
    expect(
      validateOccasionBooking({
        occasion: seatings,
        date: DATE,
        startTime: "12:00",
        guests: 4,
        bookings,
      }),
    ).toEqual({ ok: true, seating: "12:00", remaining: 4 });
  });

  it("treats a zero or broken seat limit as fully booked", () => {
    for (const capacity of [0, -5, Number.NaN]) {
      const check = validateOccasionBooking({
        occasion: { ...open, capacity: capacity as number },
        date: DATE,
        guests: 1,
        startTime: "18:00",
        bookings: [],
      });
      expect(check).toEqual({ ok: false, reason: "FULL", remaining: 0 });
    }
  });

  it("counts a booking with no party size as one seat", () => {
    const bookings: OccasionBookingLike[] = [
      { start_time: "12:00", guests_count: null, estimated_guests: null },
    ];
    expect(remainingSeats(seatings, bookings, "12:00")).toBe(3);
  });

  it("falls back to the estimated party size when the exact count is missing", () => {
    const bookings: OccasionBookingLike[] = [
      { start_time: "12:00", guests_count: null, estimated_guests: 3 },
    ];
    expect(remainingSeats(seatings, bookings, "12:00")).toBe(1);
  });
});

describe("unavailable sittings", () => {
  it("reports each sitting as full or open independently", () => {
    const bookings = [book("12:00", 4), book("15:00", 1)];
    expect(seatingAvailability(seatings, bookings)).toEqual([
      { time: "12:00", taken: 4, remaining: 0, full: true },
      { time: "15:00", taken: 1, remaining: 3, full: false },
    ]);
  });

  it("finds no sitting when every one of them is full", () => {
    const bookings = [book("12:00", 4), book("15:00", 4)];
    expect(findSeatingWithCapacity(seatings, bookings, 1)).toBeNull();
  });

  it("skips sittings that cannot fit the party and picks the next one", () => {
    const bookings = [book("12:00", 2)];
    expect(findSeatingWithCapacity(seatings, bookings, 3)).toBe("15:00");
  });

  it("refuses a sitting time that is not offered, even when seats are free", () => {
    expect(
      validateOccasionBooking({
        occasion: seatings,
        date: DATE,
        startTime: "13:30",
        guests: 1,
        bookings: [],
      }),
    ).toEqual({ ok: false, reason: "INVALID_SEATING" });
  });

  it("refuses a sittings occasion with no time chosen, or an unusable one", () => {
    for (const startTime of [null, undefined, "", "not a time", "25:00"]) {
      expect(
        validateOccasionBooking({
          occasion: seatings,
          date: DATE,
          startTime: startTime as string | null,
          guests: 1,
          bookings: [],
        }),
      ).toEqual({ ok: false, reason: "SEATING_REQUIRED" });
    }
  });

  it("accepts a stored sitting written with seconds or padding", () => {
    const occasion = { ...seatings, seating_times: '["9:00","12:00:00"]' };
    expect(seatingAvailability(occasion, []).map((s) => s.time)).toEqual([
      "09:00",
      "12:00",
    ]);
    expect(
      validateOccasionBooking({
        occasion,
        date: DATE,
        startTime: "09:00:00",
        guests: 1,
        bookings: [],
      }),
    ).toEqual({ ok: true, seating: "09:00", remaining: 4 });
  });

  it("refuses everything when a sittings occasion has no usable times", () => {
    for (const times of [[], null, "oops", [123, "nope"]]) {
      const occasion = { ...seatings, seating_times: times as unknown };
      expect(seatingAvailability(occasion, [])).toEqual([]);
      expect(
        validateOccasionBooking({
          occasion,
          date: DATE,
          startTime: "12:00",
          guests: 1,
          bookings: [],
        }),
      ).toEqual({ ok: false, reason: "INVALID_SEATING" });
    }
  });
});

describe("dates and occasions that do not match", () => {
  it("refuses a booking when the occasion does not exist", () => {
    for (const occasion of [null, undefined]) {
      expect(
        validateOccasionBooking({
          occasion,
          date: DATE,
          startTime: "12:00",
          guests: 1,
          bookings: [],
        }),
      ).toEqual({ ok: false, reason: "NOT_FOUND" });
    }
  });

  it("refuses an occasion that belongs to another date", () => {
    expect(
      validateOccasionBooking({
        occasion: seatings,
        date: "2026-05-11",
        startTime: "12:00",
        guests: 1,
        bookings: [],
      }),
    ).toEqual({ ok: false, reason: "WRONG_DATE" });
  });

  it("compares only the date part, so a timestamp still matches", () => {
    expect(
      validateOccasionBooking({
        occasion: { ...seatings, occasion_date: `${DATE}T00:00:00+03:00` },
        date: DATE,
        startTime: "12:00",
        guests: 1,
        bookings: [],
      }),
    ).toEqual({ ok: true, seating: "12:00", remaining: 4 });
  });

  it("refuses an occasion offered for a different service", () => {
    expect(
      validateOccasionBooking({
        occasion: seatings,
        date: DATE,
        reservationType: "venue",
        startTime: "12:00",
        guests: 1,
        bookings: [],
      }),
    ).toEqual({ ok: false, reason: "WRONG_TYPE" });
  });

  it("refuses an occasion staff have switched off", () => {
    expect(
      validateOccasionBooking({
        occasion: { ...seatings, is_active: false },
        date: DATE,
        startTime: "12:00",
        guests: 1,
        bookings: [],
      }),
    ).toEqual({ ok: false, reason: "INACTIVE" });
  });

  it("ignores bookings of other sittings when checking the chosen one", () => {
    const bookings = [book("15:00", 4)];
    expect(
      validateOccasionBooking({
        occasion: seatings,
        date: DATE,
        startTime: "12:00",
        guests: 4,
        bookings,
      }),
    ).toEqual({ ok: true, seating: "12:00", remaining: 4 });
  });
});
