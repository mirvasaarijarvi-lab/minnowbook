// Live end-to-end verification of special occasions against the deployed
// public-booking function.
//
// Contract under test:
//   1. Fixed sittings: only the offered sitting times are accepted, the chosen
//      sitting is what gets saved, a missing sitting is refused, and an unknown
//      sitting is refused.
//   2. Seat limits: a sitting that is full refuses further bookings, while a
//      different sitting of the same occasion is still bookable.
//   3. Open booking: the seat limit applies to the whole day.
//   4. Normal bookings stay available side by side with the occasion.
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
const ANON_KEY = requireEnv(
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
);
const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

const TEST_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";
const FN_URL = `${SUPABASE_URL}/functions/v1/public-booking`;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

// The function allows 5 requests per minute per client, so tests pace
// themselves instead of tripping the limiter and reporting a false failure.
const RATE_WINDOW_MS = 62_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function callFn(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch { /* leave null */ }
  assert(res.status !== 429, `rate limited, cannot verify: ${text}`);
  return { res, json, text };
}

async function createOccasion(fields: Record<string, unknown>): Promise<string> {
  const { res, text } = await adminFetch("/special_occasions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      tenant_id: TEST_TENANT_ID,
      is_active: true,
      ...fields,
    }),
  });
  assertEquals(res.status, 201, `occasion insert failed: ${text}`);
  const id = JSON.parse(text)[0]?.id;
  assert(typeof id === "string" && id.length > 0, `occasion id missing: ${text}`);
  return id;
}

async function deleteOccasion(id: string) {
  await adminFetch(`/special_occasions?id=eq.${id}`, { method: "DELETE" });
}

async function readReservation(id: string) {
  const { res, text } = await adminFetch(
    `/reservations?id=eq.${id}&select=id,start_time,special_occasion_id,guests_count`,
  );
  assertEquals(res.status, 200, `reservation read failed: ${text}`);
  return JSON.parse(text)[0];
}

Deno.test({
  name: "special occasions: fixed sittings enforce the offered times and their seat limits",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    const stamp = Date.now();
    const guestEmail = `occasion-seatings+${stamp}@mimmobook.test`;
    const date = isoFutureDate(45);
    const occasionId = await createOccasion({
      reservation_type: "restaurant",
      name: `Mother's Day dinner ${stamp}`,
      occasion_date: date,
      capacity: 2,
      booking_type: "seatings",
      seating_times: ["17:00", "20:00"],
    });
    const { cleanup, assertEmpty } = makeReservationCleanup({
      adminFetch,
      tenantId: TEST_TENANT_ID,
      guestEmail,
      hasServiceKey: true,
    });

    const base = {
      tenant_id: TEST_TENANT_ID,
      guest_name: `Occasion Seatings ${stamp}`,
      guest_email: guestEmail,
      reservation_type: "restaurant",
      date,
      special_occasion_id: occasionId,
    };

    try {
      // 1. First sitting, filling all 2 seats.
      const first = await callFn({ ...base, start_time: "17:00", guests_count: 2 });
      assertEquals(first.res.status, 200, `first sitting refused: ${first.text}`);
      assertEquals(first.json?.success, true);
      const firstRow = await readReservation(first.json.reservation.id);
      assertEquals(firstRow.start_time, "17:00:00", "the chosen sitting must be saved");
      assertEquals(firstRow.special_occasion_id, occasionId);

      // 2. That sitting is now full.
      const full = await callFn({ ...base, start_time: "17:00", guests_count: 1 });
      assert(full.res.status >= 400, `a full sitting must be refused: ${full.text}`);
      assert(
        /fully booked/i.test(full.text),
        `refusal must say the sitting is full: ${full.text}`,
      );

      // 3. The other sitting is still bookable.
      const other = await callFn({ ...base, start_time: "20:00", guests_count: 1 });
      assertEquals(other.res.status, 200, `second sitting refused: ${other.text}`);
      const otherRow = await readReservation(other.json.reservation.id);
      assertEquals(otherRow.start_time, "20:00:00");

      // 4. No sitting chosen at all.
      const missing = await callFn({ ...base, guests_count: 1 });
      assert(missing.res.status >= 400, `a missing sitting must be refused: ${missing.text}`);
      assert(/sitting/i.test(missing.text), `refusal must mention the sitting: ${missing.text}`);

      // 5. A sitting time that was never offered.
      const invalid = await callFn({ ...base, start_time: "18:30", guests_count: 1 });
      assert(invalid.res.status >= 400, `an unknown sitting must be refused: ${invalid.text}`);
      assert(/sitting/i.test(invalid.text), `refusal must mention the sitting: ${invalid.text}`);
    } finally {
      await cleanup();
      await assertEmpty();
      await deleteOccasion(occasionId);
    }
  },
});

Deno.test({
  name: "special occasions: open booking limits seats per day and normal bookings still work",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    // Give the per-minute limiter a fresh window after the previous test.
    await wait(RATE_WINDOW_MS);

    const stamp = Date.now();
    const guestEmail = `occasion-open+${stamp}@mimmobook.test`;
    const date = isoFutureDate(46);
    const occasionId = await createOccasion({
      reservation_type: "restaurant",
      name: `Christmas buffet ${stamp}`,
      occasion_date: date,
      capacity: 3,
      booking_type: "open",
      seating_times: [],
    });
    const { cleanup, assertEmpty } = makeReservationCleanup({
      adminFetch,
      tenantId: TEST_TENANT_ID,
      guestEmail,
      hasServiceKey: true,
    });

    const base = {
      tenant_id: TEST_TENANT_ID,
      guest_name: `Occasion Open ${stamp}`,
      guest_email: guestEmail,
      reservation_type: "restaurant",
      date,
    };

    try {
      // Open booking: any time within the day is accepted, seats count per day.
      const first = await callFn({
        ...base,
        special_occasion_id: occasionId,
        start_time: "13:45",
        guests_count: 3,
      });
      assertEquals(first.res.status, 200, `open occasion booking refused: ${first.text}`);
      const firstRow = await readReservation(first.json.reservation.id);
      assertEquals(firstRow.start_time, "13:45:00", "open booking keeps the guest's own time");
      assertEquals(firstRow.special_occasion_id, occasionId);

      // The day's seats are used up.
      const full = await callFn({
        ...base,
        special_occasion_id: occasionId,
        start_time: "18:00",
        guests_count: 1,
      });
      assert(full.res.status >= 400, `a full occasion must be refused: ${full.text}`);
      assert(/fully booked/i.test(full.text), `refusal must say it is full: ${full.text}`);

      // A normal booking on the same date, without the occasion, still works.
      const normal = await callFn({ ...base, start_time: "19:30", guests_count: 2 });
      assertEquals(normal.res.status, 200, `normal booking refused: ${normal.text}`);
      const normalRow = await readReservation(normal.json.reservation.id);
      assertEquals(
        normalRow.special_occasion_id,
        null,
        "a normal booking must not be attached to the occasion",
      );
      assertEquals(normalRow.start_time, "19:30:00");
    } finally {
      await cleanup();
      await assertEmpty();
      await deleteOccasion(occasionId);
    }
  },
});

Deno.test({
  name: "special occasions: over-capacity parties, wrong dates and unknown occasions are refused",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    // Fresh window for the per-minute limiter.
    await wait(RATE_WINDOW_MS);

    const stamp = Date.now();
    const guestEmail = `occasion-edge+${stamp}@mimmobook.test`;
    const date = isoFutureDate(47);
    const otherDate = isoFutureDate(48);
    const occasionId = await createOccasion({
      reservation_type: "restaurant",
      name: `Edge case dinner ${stamp}`,
      occasion_date: date,
      capacity: 2,
      booking_type: "seatings",
      seating_times: ["19:00"],
    });
    const { cleanup, assertEmpty } = makeReservationCleanup({
      adminFetch,
      tenantId: TEST_TENANT_ID,
      guestEmail,
      hasServiceKey: true,
    });

    const base = {
      tenant_id: TEST_TENANT_ID,
      guest_name: `Occasion Edge ${stamp}`,
      guest_email: guestEmail,
      reservation_type: "restaurant",
    };

    try {
      // 1. A single party larger than the whole occasion.
      const tooBig = await callFn({
        ...base,
        date,
        special_occasion_id: occasionId,
        start_time: "19:00",
        guests_count: 6,
      });
      assert(tooBig.res.status >= 400, `an over-capacity party must be refused: ${tooBig.text}`);
      assert(/fully booked/i.test(tooBig.text), `refusal must say it is full: ${tooBig.text}`);

      // 2. The occasion attached to a date it does not belong to.
      const wrongDate = await callFn({
        ...base,
        date: otherDate,
        special_occasion_id: occasionId,
        start_time: "19:00",
        guests_count: 2,
      });
      assert(wrongDate.res.status >= 400, `a wrong date must be refused: ${wrongDate.text}`);
      assert(
        /different date/i.test(wrongDate.text),
        `refusal must name the date problem: ${wrongDate.text}`,
      );

      // 3. An occasion id that does not exist.
      const unknown = await callFn({
        ...base,
        date,
        special_occasion_id: "00000000-0000-0000-0000-000000000000",
        start_time: "19:00",
        guests_count: 2,
      });
      assert(unknown.res.status >= 400, `an unknown occasion must be refused: ${unknown.text}`);
      assert(
        /no longer available/i.test(unknown.text),
        `refusal must say it is unavailable: ${unknown.text}`,
      );

      // 4. A date with no occasion at all still books normally.
      const plain = await callFn({ ...base, date: otherDate, start_time: "12:15", guests_count: 2 });
      assertEquals(plain.res.status, 200, `a normal booking must still work: ${plain.text}`);
      const plainRow = await readReservation(plain.json.reservation.id);
      assertEquals(plainRow.special_occasion_id, null);
      assertEquals(plainRow.start_time, "12:15:00");
    } finally {
      await cleanup();
      await assertEmpty();
      await deleteOccasion(occasionId);
    }
  },
});
