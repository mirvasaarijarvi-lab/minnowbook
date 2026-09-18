// Regression tests for the public-booking retry de-duplication rules.
//
// The bug these guard against: a second booking by the same guest on the same
// day was silently dropped because the duplicate lookup ignored the fields a
// guest actually varies (room, resource, checkout date, guest count, time,
// notes). Two rooms for the same nights, or a second table for the same
// evening, returned "booking confirmed" while only one reservation existed.
//
// Hermetic: no network, no database, no credentials.
import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyDedupFilters,
  buildDedupFilters,
  DEDUP_MATCH_COLUMNS,
  type DedupFields,
  isSameBooking,
  RETRY_WINDOW_MINUTES,
} from "./booking-dedup.ts";

/** Records every filter the handler would send to PostgREST. */
class FakeQuery {
  calls: Array<{ op: "eq" | "is"; column: string; value: unknown }> = [];
  eq(column: string, value: never) {
    this.calls.push({ op: "eq", column, value });
    return this;
  }
  is(column: string, value: null) {
    this.calls.push({ op: "is", column, value });
    return this;
  }
  /** Stable signature of the whole filter set, for comparing two bookings. */
  signature(): string {
    return this.calls
      .map((c) => `${c.column}:${c.op}:${JSON.stringify(c.value ?? null)}`)
      .sort()
      .join("|");
  }
}

function signatureOf(fields: DedupFields): string {
  const q = new FakeQuery();
  applyDedupFilters(q, fields);
  return q.signature();
}

/** A realistic hotel booking used as the baseline in the matrix below. */
const BASE: DedupFields = {
  start_time: "18:30",
  resource_id: "11111111-1111-4111-8111-111111111111",
  room_type: "double",
  check_out_date: "2026-10-05",
  guests_count: 2,
  estimated_guests: null,
  special_requests: "High floor, please",
};

Deno.test("dedup: retry window stays at 15 minutes", () => {
  assertEquals(RETRY_WINDOW_MINUTES, 15);
});

Deno.test("dedup: every guest-variable field is part of the comparison", () => {
  // If a field is dropped from this list, distinct bookings collapse again.
  assertEquals([...DEDUP_MATCH_COLUMNS], [
    "start_time",
    "resource_id",
    "room_type",
    "check_out_date",
    "guests_count",
    "estimated_guests",
    "special_requests",
  ]);
  assertEquals(buildDedupFilters(BASE).length, DEDUP_MATCH_COLUMNS.length);
});

Deno.test("dedup: an exact repeat is treated as the same booking", () => {
  const repeat: DedupFields = { ...BASE };
  assert(isSameBooking(BASE, repeat));
  assertEquals(signatureOf(BASE), signatureOf(repeat));
});

Deno.test("dedup: absent and explicitly null values behave identically", () => {
  const withNulls: DedupFields = { ...BASE, estimated_guests: null };
  const withUndefined: DedupFields = { ...BASE, estimated_guests: undefined };
  assert(isSameBooking(withNulls, withUndefined));
  assertEquals(signatureOf(withNulls), signatureOf(withUndefined));
});

// The heart of the regression: each of these differs from BASE in exactly one
// guest-visible way and MUST therefore become its own reservation.
const DISTINCT_BOOKINGS: Array<{ label: string; fields: DedupFields }> = [
  {
    label: "a second room (different resource)",
    fields: { ...BASE, resource_id: "22222222-2222-4222-8222-222222222222" },
  },
  {
    label: "a different room type",
    fields: { ...BASE, room_type: "suite" },
  },
  {
    label: "different nights (checkout date)",
    fields: { ...BASE, check_out_date: "2026-10-07" },
  },
  {
    label: "a different number of guests",
    fields: { ...BASE, guests_count: 4 },
  },
  {
    label: "a different estimated guest count",
    fields: { ...BASE, estimated_guests: 30 },
  },
  {
    label: "a different sitting time",
    fields: { ...BASE, start_time: "20:00" },
  },
  {
    label: "different notes",
    fields: { ...BASE, special_requests: "Ground floor, please" },
  },
  {
    label: "notes added where there were none",
    fields: { ...BASE, special_requests: null },
  },
  {
    label: "no time given (walk-in style) vs a timed booking",
    fields: { ...BASE, start_time: null },
  },
  {
    label: "no resource chosen vs a specific resource",
    fields: { ...BASE, resource_id: null },
  },
];

for (const { label, fields } of DISTINCT_BOOKINGS) {
  Deno.test(`dedup: ${label} is NOT a duplicate`, () => {
    assertEquals(
      isSameBooking(BASE, fields),
      false,
      `"${label}" was wrongly treated as a repeat of the first booking`,
    );
    assertNotEquals(
      signatureOf(BASE),
      signatureOf(fields),
      `"${label}" produced the same lookup filters as the first booking, ` +
        `so the second reservation would be silently dropped`,
    );
  });
}

Deno.test("dedup: distinct bookings all differ from each other, not just from the baseline", () => {
  const seen = new Map<string, string>();
  seen.set(signatureOf(BASE), "baseline");
  for (const { label, fields } of DISTINCT_BOOKINGS) {
    const sig = signatureOf(fields);
    const clash = seen.get(sig);
    assertEquals(
      clash,
      undefined,
      `"${label}" collides with "${clash}" and would be dropped as a duplicate`,
    );
    seen.set(sig, label);
  }
});

Deno.test("dedup: empty values use IS NULL, never = NULL", () => {
  const q = new FakeQuery();
  applyDedupFilters(q, {
    start_time: null,
    resource_id: undefined,
    room_type: null,
    check_out_date: undefined,
    guests_count: null,
    estimated_guests: undefined,
    special_requests: null,
  });
  assertEquals(q.calls.length, DEDUP_MATCH_COLUMNS.length);
  for (const call of q.calls) {
    assertEquals(call.op, "is", `${call.column} must be matched with IS NULL`);
    assertEquals(call.value, null);
  }
});

Deno.test("dedup: present values use equality on the exact column", () => {
  const q = new FakeQuery();
  applyDedupFilters(q, BASE);
  const eqColumns = q.calls.filter((c) => c.op === "eq").map((c) => c.column);
  assertEquals(eqColumns, [
    "start_time",
    "resource_id",
    "room_type",
    "check_out_date",
    "guests_count",
    "special_requests",
  ]);
  const isColumns = q.calls.filter((c) => c.op === "is").map((c) => c.column);
  assertEquals(isColumns, ["estimated_guests"]);
});

Deno.test("dedup: comparison is symmetric and order independent", () => {
  for (const { fields } of DISTINCT_BOOKINGS) {
    assertEquals(isSameBooking(BASE, fields), isSameBooking(fields, BASE));
  }
  assert(isSameBooking(BASE, { ...BASE }));
});
