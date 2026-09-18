import { describe, it, expect } from "vitest";
import {
  normalizeTime,
  parseSeatingTimes,
  seatsTaken,
  remainingSeats,
  seatingAvailability,
  findSeatingWithCapacity,
  validateOccasionBooking,
  type SpecialOccasionLike,
} from "../../supabase/functions/_shared/special-occasions";

const seatingsOccasion: SpecialOccasionLike = {
  id: "occ-1",
  name: "Mother's Day lunch",
  occasion_date: "2026-05-10",
  reservation_type: "restaurant",
  capacity: 20,
  booking_type: "seatings",
  seating_times: ["12:00", "15:00", "18:00"],
  is_active: true,
};

const openOccasion: SpecialOccasionLike = {
  ...seatingsOccasion,
  id: "occ-2",
  booking_type: "open",
  seating_times: [],
  capacity: 30,
};

describe("normalizeTime", () => {
  it("normalizes usable values and rejects the rest", () => {
    expect(normalizeTime("9:30")).toBe("09:30");
    expect(normalizeTime("18:00:00")).toBe("18:00");
    expect(normalizeTime("24:00")).toBeNull();
    expect(normalizeTime("18:99")).toBeNull();
    expect(normalizeTime(null)).toBeNull();
    expect(normalizeTime(1800 as unknown)).toBeNull();
  });
});

describe("parseSeatingTimes", () => {
  it("accepts arrays, JSON strings and comma lists", () => {
    expect(parseSeatingTimes(["18:00", "12:00"])).toEqual(["12:00", "18:00"]);
    expect(parseSeatingTimes('["12:00","15:00"]')).toEqual(["12:00", "15:00"]);
    expect(parseSeatingTimes("12:00,15:00")).toEqual(["12:00", "15:00"]);
  });

  it("drops duplicates and junk", () => {
    expect(parseSeatingTimes(["12:00", "12:00:00", "nope", null, 5])).toEqual([
      "12:00",
    ]);
    expect(parseSeatingTimes(null)).toEqual([]);
    expect(parseSeatingTimes({})).toEqual([]);
  });
});

describe("seat counting", () => {
  const bookings = [
    { start_time: "12:00", guests_count: 4, status: "confirmed" },
    { start_time: "12:00:00", guests_count: 6, status: "pending" },
    { start_time: "15:00", guests_count: 8, status: "confirmed" },
    { start_time: "12:00", guests_count: 10, status: "cancelled" },
  ];

  it("counts only the same sitting for a sittings occasion", () => {
    expect(seatsTaken(seatingsOccasion, bookings, "12:00")).toBe(10);
    expect(seatsTaken(seatingsOccasion, bookings, "15:00")).toBe(8);
    expect(seatsTaken(seatingsOccasion, bookings, "18:00")).toBe(0);
  });

  it("pools the whole day for an open occasion", () => {
    expect(seatsTaken(openOccasion, bookings)).toBe(18);
    expect(remainingSeats(openOccasion, bookings)).toBe(12);
  });

  it("ignores cancelled and rejected bookings", () => {
    expect(
      seatsTaken(openOccasion, [{ guests_count: 5, status: "rejected" }]),
    ).toBe(0);
  });

  it("falls back to estimated guests, then to one seat", () => {
    expect(seatsTaken(openOccasion, [{ estimated_guests: 7 }])).toBe(7);
    expect(seatsTaken(openOccasion, [{}])).toBe(1);
    expect(seatsTaken(openOccasion, [{ guests_count: 0 }])).toBe(1);
  });

  it("never reports negative remaining seats", () => {
    expect(
      remainingSeats({ ...openOccasion, capacity: 3 }, [{ guests_count: 40 }]),
    ).toBe(0);
  });
});

describe("seatingAvailability and findSeatingWithCapacity", () => {
  const bookings = [
    { start_time: "12:00", guests_count: 20, status: "confirmed" },
  ];

  it("marks a filled sitting as full", () => {
    const slots = seatingAvailability(seatingsOccasion, bookings);
    expect(slots.map((s) => s.time)).toEqual(["12:00", "15:00", "18:00"]);
    expect(slots[0]).toMatchObject({ taken: 20, remaining: 0, full: true });
    expect(slots[1]).toMatchObject({ remaining: 20, full: false });
  });

  it("returns no sittings for an open occasion", () => {
    expect(seatingAvailability(openOccasion, bookings)).toEqual([]);
  });

  it("suggests the first sitting that fits the party", () => {
    expect(findSeatingWithCapacity(seatingsOccasion, bookings, 4)).toBe(
      "15:00",
    );
    expect(findSeatingWithCapacity(seatingsOccasion, bookings, 21)).toBeNull();
  });
});

describe("validateOccasionBooking", () => {
  const base = {
    date: "2026-05-10",
    reservationType: "restaurant",
    bookings: [] as never[],
  };

  it("accepts a valid sitting", () => {
    expect(
      validateOccasionBooking({
        ...base,
        occasion: seatingsOccasion,
        startTime: "12:00",
        guests: 4,
      }),
    ).toEqual({ ok: true, seating: "12:00", remaining: 20 });
  });

  it("rejects a missing occasion", () => {
    expect(validateOccasionBooking({ ...base, occasion: null })).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });

  it("rejects an inactive occasion", () => {
    expect(
      validateOccasionBooking({
        ...base,
        occasion: { ...seatingsOccasion, is_active: false },
        startTime: "12:00",
      }),
    ).toEqual({ ok: false, reason: "INACTIVE" });
  });

  it("rejects a mismatched date or service", () => {
    expect(
      validateOccasionBooking({
        ...base,
        date: "2026-05-11",
        occasion: seatingsOccasion,
        startTime: "12:00",
      }),
    ).toEqual({ ok: false, reason: "WRONG_DATE" });
    expect(
      validateOccasionBooking({
        ...base,
        reservationType: "venue",
        occasion: seatingsOccasion,
        startTime: "12:00",
      }),
    ).toEqual({ ok: false, reason: "WRONG_TYPE" });
  });

  it("requires a known sitting time", () => {
    expect(
      validateOccasionBooking({
        ...base,
        occasion: seatingsOccasion,
        startTime: null,
      }),
    ).toEqual({ ok: false, reason: "SEATING_REQUIRED" });
    expect(
      validateOccasionBooking({
        ...base,
        occasion: seatingsOccasion,
        startTime: "13:00",
      }),
    ).toEqual({ ok: false, reason: "INVALID_SEATING" });
  });

  it("rejects a party larger than the seats left", () => {
    const bookings = [
      { start_time: "12:00", guests_count: 18, status: "confirmed" },
    ];
    expect(
      validateOccasionBooking({
        ...base,
        bookings,
        occasion: seatingsOccasion,
        startTime: "12:00",
        guests: 4,
      }),
    ).toEqual({ ok: false, reason: "FULL", remaining: 2 });
  });

  it("ignores the time for an open occasion but still enforces capacity", () => {
    expect(
      validateOccasionBooking({
        ...base,
        occasion: openOccasion,
        startTime: null,
        guests: 5,
      }),
    ).toEqual({ ok: true, seating: null, remaining: 30 });
    expect(
      validateOccasionBooking({
        ...base,
        occasion: openOccasion,
        bookings: [{ guests_count: 28, status: "confirmed" }] as never,
        guests: 5,
      }),
    ).toEqual({ ok: false, reason: "FULL", remaining: 2 });
  });

  it("compares dates by day, ignoring any timestamp tail", () => {
    expect(
      validateOccasionBooking({
        ...base,
        date: "2026-05-10T00:00:00Z",
        occasion: {
          ...seatingsOccasion,
          occasion_date: "2026-05-10T12:00:00Z",
        },
        startTime: "12:00",
        guests: 2,
      }),
    ).toMatchObject({ ok: true });
  });
});
