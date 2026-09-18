// Live verification that simultaneous bookings cannot oversell a special
// occasion, for both fixed sittings and open booking.
//
// The public-booking function checks seats before inserting, but two requests
// arriving at the same moment can read the same "seats left" snapshot. The
// database trigger `enforce_special_occasion_capacity` locks the occasion row
// and recounts, so the total stored can never exceed the capacity.
//
// Skipped without a service-role key: the test creates and deletes rows on the
// seeded tenant.
import "../_shared/load-env.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeReservationCleanup } from "../_shared/test-cleanup.ts";

function requireEnv(...names: string[]): string {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  throw new Error(`Missing required env var. Set one of: ${names.join(", ")}`);
}

const SUPABASE_URL = requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

const TEST_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";
const REST_URL = `${SUPABASE_URL}/rest/v1`;

function isoFutureDate(daysAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

async function adminFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${REST_URL}${path}`, { ...init, headers });
  const text = await res.text();
  return { res, text };
}

async function createOccasion(fields: Record<string, unknown>): Promise<string> {
  const { res, text } = await adminFetch("/special_occasions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ tenant_id: TEST_TENANT_ID, is_active: true, ...fields }),
  });
  assertEquals(res.status, 201, `occasion insert failed: ${text}`);
  const id = JSON.parse(text)[0]?.id;
  assert(typeof id === "string" && id.length > 0, `occasion id missing: ${text}`);
  return id;
}

async function deleteOccasion(id: string) {
  await adminFetch(`/special_occasions?id=eq.${id}`, { method: "DELETE" });
}

/**
 * One booking insert, exactly as the edge function stores it, sent straight to
 * the database. This bypasses the per-minute rate limiter so a real burst of
 * simultaneous writes can be tested, and it is the write the seat guard has to
 * hold the line on.
 */
async function insertBooking(row: Record<string, unknown>) {
  const { res, text } = await adminFetch("/reservations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  return { ok: res.status === 201, status: res.status, text };
}

async function seatsStored(occasionId: string, startTime?: string) {
  const filter = startTime ? `&start_time=eq.${startTime}` : "";
  const { res, text } = await adminFetch(
    `/reservations?special_occasion_id=eq.${occasionId}${filter}&select=guests_count,status`,
  );
  assertEquals(res.status, 200, `seat read failed: ${text}`);
  return (JSON.parse(text) as Array<{ guests_count: number | null; status: string | null }>)
    .filter((r) => (r.status ?? "").toLowerCase() !== "cancelled")
    .reduce((sum, r) => sum + Math.max(1, r.guests_count ?? 1), 0);
}

Deno.test({
  name: "special occasions: simultaneous bookings never oversell a fixed sitting",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    const stamp = Date.now();
    const guestEmail = `occasion-race-seatings+${stamp}@mimmobook.test`;
    const date = isoFutureDate(51);
    const occasionId = await createOccasion({
      reservation_type: "restaurant",
      name: `Race sittings ${stamp}`,
      occasion_date: date,
      capacity: 4,
      booking_type: "seatings",
      seating_times: ["17:00", "20:00"],
    });
    const { cleanup, assertEmpty } = makeReservationCleanup({
      adminFetch,
      tenantId: TEST_TENANT_ID,
      guestEmail,
      hasServiceKey: true,
    });

    const row = (startTime: string, guests: number) => ({
      tenant_id: TEST_TENANT_ID,
      guest_name: `Occasion Race ${stamp}`,
      guest_email: guestEmail,
      reservation_type: "restaurant",
      status: "pending",
      date,
      start_time: startTime,
      guests_count: guests,
      special_occasion_id: occasionId,
    });

    try {
      // Eight parties of 2 all try the 17:00 sitting at once; only 4 seats exist.
      const first = await Promise.all(
        Array.from({ length: 8 }, () => insertBooking(row("17:00", 2))),
      );
      const accepted = first.filter((r) => r.ok).length;
      const refused = first.filter((r) => !r.ok);
      assertEquals(accepted, 2, `exactly 2 parties of 2 fit in 4 seats: ${JSON.stringify(first)}`);
      assert(refused.length === 6, "the rest must be refused");
      for (const r of refused) {
        assert(
          /fully booked/i.test(r.text),
          `refusal must say the sitting is full: ${r.text}`,
        );
      }
      assertEquals(await seatsStored(occasionId, "17:00"), 4, "the sitting must hold 4 seats");

      // The other sitting is untouched by the first sitting filling up, and it
      // enforces its own limit under the same burst.
      const second = await Promise.all([
        insertBooking(row("20:00", 3)),
        insertBooking(row("20:00", 3)),
        insertBooking(row("20:00", 1)),
        insertBooking(row("20:00", 1)),
      ]);
      const secondSeats = await seatsStored(occasionId, "20:00");
      assert(secondSeats > 0, "the second sitting must still be bookable");
      assert(secondSeats <= 4, `the second sitting oversold: ${secondSeats} seats`);
      assert(
        second.some((r) => r.ok) && second.some((r) => !r.ok),
        `some must pass and some must be refused: ${JSON.stringify(second)}`,
      );

      // Nothing leaked into the occasion beyond its two sittings.
      assertEquals(await seatsStored(occasionId), 4 + secondSeats);
    } finally {
      await cleanup();
      await assertEmpty();
      await deleteOccasion(occasionId);
    }
  },
});

Deno.test({
  name: "special occasions: simultaneous bookings never oversell an open-booking day",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    const stamp = Date.now();
    const guestEmail = `occasion-race-open+${stamp}@mimmobook.test`;
    const date = isoFutureDate(52);
    const occasionId = await createOccasion({
      reservation_type: "restaurant",
      name: `Race open ${stamp}`,
      occasion_date: date,
      capacity: 5,
      booking_type: "open",
      seating_times: [],
    });
    const { cleanup, assertEmpty } = makeReservationCleanup({
      adminFetch,
      tenantId: TEST_TENANT_ID,
      guestEmail,
      hasServiceKey: true,
    });

    const row = (startTime: string, guests: number) => ({
      tenant_id: TEST_TENANT_ID,
      guest_name: `Occasion Race Open ${stamp}`,
      guest_email: guestEmail,
      reservation_type: "restaurant",
      status: "pending",
      date,
      start_time: startTime,
      guests_count: guests,
      special_occasion_id: occasionId,
    });

    try {
      // Six parties of 2 at six different times of day, one 5-seat pool.
      const times = ["11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];
      const results = await Promise.all(times.map((t) => insertBooking(row(t, 2))));
      const accepted = results.filter((r) => r.ok).length;
      assertEquals(accepted, 2, `only 2 parties of 2 fit in 5 seats: ${JSON.stringify(results)}`);
      assertEquals(await seatsStored(occasionId), 4, "open booking counts across the day");
      for (const r of results.filter((x) => !x.ok)) {
        assert(/fully booked/i.test(r.text), `refusal must say it is full: ${r.text}`);
      }

      // The last seat is still usable, and a party that does not fit is refused.
      const tail = await Promise.all([
        insertBooking(row("22:00", 2)),
        insertBooking(row("22:30", 1)),
      ]);
      assert(tail.some((r) => r.ok), "the remaining seat must be bookable");
      assertEquals(await seatsStored(occasionId), 5, "the day must stop at its capacity");

      // Once full, every further booking is refused.
      const overflow = await Promise.all([
        insertBooking(row("23:00", 1)),
        insertBooking(row("23:30", 1)),
      ]);
      assert(overflow.every((r) => !r.ok), `a full day must refuse: ${JSON.stringify(overflow)}`);
      assertEquals(await seatsStored(occasionId), 5);

      // A cancelled booking gives its seats back.
      const { res: pickRes, text: pickText } = await adminFetch(
        `/reservations?special_occasion_id=eq.${occasionId}&guests_count=eq.2&select=id&limit=1`,
      );
      assertEquals(pickRes.status, 200, `could not pick a booking to cancel: ${pickText}`);
      const cancelId = JSON.parse(pickText)[0]?.id;
      assert(typeof cancelId === "string", `no booking to cancel: ${pickText}`);
      const { res: cancelRes, text: cancelText } = await adminFetch(
        `/reservations?id=eq.${cancelId}`,
        { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) },
      );
      assert(cancelRes.status < 300, `cancel must succeed: ${cancelText}`);
      const afterCancel = await insertBooking(row("23:45", 1));
      assert(afterCancel.ok, `a cancelled booking must free seats: ${afterCancel.text}`);
    } finally {
      await cleanup();
      await assertEmpty();
      await deleteOccasion(occasionId);
    }
  },
});
