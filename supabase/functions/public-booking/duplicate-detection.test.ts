// End-to-end regression test for the "second booking silently dropped" bug.
//
// Contract under test, against the deployed edge function:
//   1. Two bookings by the SAME guest on the SAME day that differ in any
//      guest-visible way (time, guest count, notes, resource/room type) each
//      create their own reservation row and are never reported as duplicates.
//   2. An exact repeat of a booking inside the retry window creates no second
//      row, returns the FIRST reservation id, and is flagged `duplicate: true`
//      so the booking page can say so plainly instead of showing an ambiguous
//      confirmation.
//
// Skipped without a service-role key: the test inserts rows on the seeded
// tenant and must be able to delete them again.
import "../_shared/load-env.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeReservationCleanup } from "../_shared/test-cleanup.ts";
import { DEDUP_MATCH_COLUMNS } from "../_shared/booking-dedup.ts";

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

function isoFutureDate(daysAhead = 30): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
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
  return { res, json, text };
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

async function countRows(guestEmail: string): Promise<number> {
  const { res, text } = await adminFetch(
    `/reservations?tenant_id=eq.${TEST_TENANT_ID}` +
      `&guest_email=eq.${encodeURIComponent(guestEmail)}&select=id`,
  );
  assertEquals(res.status, 200, `row count query failed: ${text}`);
  return (JSON.parse(text) as unknown[]).length;
}

// The rate limiter allows a handful of requests per minute per client, so the
// variants below are deliberately few and each one is asserted precisely.
Deno.test({
  name:
    "public-booking: bookings differing in time, guests or notes each create their own reservation",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    const stamp = Date.now();
    const guestEmail = `dupcheck+${stamp}@mimmobook.test`;
    const guestName = `DupCheck Test ${stamp}`;
    const date = isoFutureDate(30);

    const { cleanup, assertEmpty } = makeReservationCleanup({
      adminFetch,
      tenantId: TEST_TENANT_ID,
      guestEmail,
      hasServiceKey: true,
    });

    const base = {
      tenant_id: TEST_TENANT_ID,
      guest_name: guestName,
      guest_email: guestEmail,
      reservation_type: "restaurant",
      date,
      start_time: "18:00",
      guests_count: 2,
    };

    try {
      const variants: Array<{ label: string; body: Record<string, unknown> }> = [
        { label: "first booking", body: { ...base } },
        {
          label: "second table, later sitting",
          body: { ...base, start_time: "20:30" },
        },
        {
          label: "same sitting, different party size",
          body: { ...base, guests_count: 5 },
        },
        {
          label: "same sitting and party size, different notes",
          body: { ...base, special_requests: `Window table ${stamp}` },
        },
      ];

      const ids: string[] = [];
      for (const { label, body } of variants) {
        const out = await callFn(body);
        assertEquals(
          out.res.status,
          200,
          `${label}: unexpected status ${out.res.status}: ${out.text}`,
        );
        assertEquals(out.json?.success, true, `${label}: expected success`);
        assert(
          !out.json?.duplicate,
          `${label} was wrongly reported as a duplicate; the guest would see a ` +
            `confirmation for a booking that was never created`,
        );
        const id = out.json?.reservation?.id;
        assert(typeof id === "string" && id.length > 0, `${label}: missing reservation id`);
        assert(!ids.includes(id), `${label} reused reservation ${id}`);
        ids.push(id);
      }

      assertEquals(ids.length, variants.length);
      assertEquals(
        await countRows(guestEmail),
        variants.length,
        "every distinct booking must exist as its own reservation row",
      );
    } finally {
      await cleanup();
      await assertEmpty();
    }
  },
});

Deno.test({
  name:
    "public-booking: an exact repeat creates no second reservation and is flagged duplicate",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    const stamp = Date.now();
    const guestEmail = `dupexact+${stamp}@mimmobook.test`;
    const guestName = `DupExact Test ${stamp}`;
    const date = isoFutureDate(31);

    const { cleanup, assertEmpty } = makeReservationCleanup({
      adminFetch,
      tenantId: TEST_TENANT_ID,
      guestEmail,
      hasServiceKey: true,
    });

    const body = {
      tenant_id: TEST_TENANT_ID,
      guest_name: guestName,
      guest_email: guestEmail,
      reservation_type: "restaurant",
      date,
      start_time: "19:15",
      guests_count: 3,
      special_requests: `Quiet corner ${stamp}`,
    };

    try {
      const first = await callFn(body);
      assertEquals(first.res.status, 200, `first send failed: ${first.text}`);
      assertEquals(first.json?.success, true);
      assert(!first.json?.duplicate, "the first send must not be a duplicate");
      const firstId = first.json?.reservation?.id;
      assert(typeof firstId === "string" && firstId.length > 0);

      // Byte-identical resend, as a double click or automatic retry would do.
      const repeat = await callFn(body);
      assertEquals(repeat.res.status, 200, `repeat failed: ${repeat.text}`);
      assertEquals(repeat.json?.success, true);
      assertEquals(
        repeat.json?.duplicate,
        true,
        "an exact repeat must be flagged duplicate so the guest is told plainly",
      );
      assertEquals(
        repeat.json?.reservation?.id,
        firstId,
        "the repeat must return the first reservation, not a new one",
      );

      assertEquals(
        await countRows(guestEmail),
        1,
        "an exact repeat must never create a second reservation row",
      );
    } finally {
      await cleanup();
      await assertEmpty();
    }
  },
});

// Guard for the second half of the bug: the lookup once filtered on
// `resource_id`, which is not a column on reservations. PostgREST rejected the
// whole query, the handler logged a warning and skipped de-duplication, and a
// double click created two reservations. This test fails the moment a dedup
// column stops existing.
Deno.test({
  name: "public-booking: every de-duplication column exists on reservations",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    for (const column of DEDUP_MATCH_COLUMNS) {
      const { res, text } = await adminFetch(
        `/reservations?select=${column}&limit=1`,
      );
      assertEquals(
        res.status,
        200,
        `de-duplication column "${column}" is not selectable on reservations: ${text}`,
      );
    }
    // And the whole filter set together, exactly as the handler sends it.
    const all = DEDUP_MATCH_COLUMNS.join(",");
    const { res, text } = await adminFetch(`/reservations?select=${all}&limit=1`);
    assertEquals(res.status, 200, `combined dedup select failed: ${text}`);
  },
});
