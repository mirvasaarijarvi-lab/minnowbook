// End-to-end integration test for cross-bookings.
//
// A cross-booking is N independent reservation rows (one per resource/service
// "leg") that share a single `linked_group_id` UUID. The public-booking
// edge function MUST:
//   1. Accept an optional `linked_group_id` on the request body.
//   2. Persist that value on the inserted row.
//   3. After insert, return every other non-cancelled sibling sharing
//      the same `linked_group_id` in `linked_siblings`.
//
// This test creates two legs (restaurant + venue) under one shared
// linked_group_id and verifies all three contracts above.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
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

function isoFutureDate(daysAhead = 14): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

// Crypto-strength UUID for the shared linked_group_id. Using the platform
// API rather than hand-rolled randomness keeps the value valid for the
// edge function's `validateUuid` strict check.
function newGroupId(): string {
  return crypto.randomUUID();
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
  try { json = JSON.parse(text); } catch { /* leave null */ }
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

Deno.test({
  name: "public-booking: cross-booking persists linked_group_id and returns siblings",
  // Skip cleanly when destructive cleanup is not available; without the
  // service key we cannot delete the rows we'd insert, so we'd leak data
  // on the seeded tenant.
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    const stamp = Date.now();
    const guestEmail = `xbook+${stamp}@mimmobook.test`;
    const guestName = `XBook Test ${stamp}`;
    const date = isoFutureDate(28);
    const groupId = newGroupId();

    const { cleanup, assertEmpty } = makeReservationCleanup({
      adminFetch,
      tenantId: TEST_TENANT_ID,
      guestEmail,
      hasServiceKey: true,
    });

    try {
      // ---------- Leg 1: restaurant ----------
      const leg1 = await callFn({
        tenant_id: TEST_TENANT_ID,
        guest_name: guestName,
        guest_email: guestEmail,
        reservation_type: "restaurant",
        date,
        start_time: "18:00",
        guests_count: 2,
        linked_group_id: groupId,
      });
      assertEquals(
        leg1.res.status,
        200,
        `leg1 unexpected status ${leg1.res.status}: ${JSON.stringify(leg1.json)}`,
      );
      assertEquals(leg1.json?.success, true);
      assertEquals(
        leg1.json?.linked_group_id,
        groupId,
        "leg1 must echo linked_group_id",
      );
      assertEquals(
        leg1.json?.reservation?.linked_group_id,
        groupId,
        "leg1.reservation must carry linked_group_id",
      );
      // First leg: no prior siblings in the group yet.
      assert(
        Array.isArray(leg1.json?.linked_siblings),
        "linked_siblings must be an array",
      );
      assertEquals(
        leg1.json.linked_siblings.length,
        0,
        `first leg should have 0 siblings, got ${leg1.json.linked_siblings.length}`,
      );

      // ---------- Leg 2: venue, same group ----------
      const leg2 = await callFn({
        tenant_id: TEST_TENANT_ID,
        guest_name: guestName,
        guest_email: guestEmail,
        reservation_type: "venue",
        date,
        start_time: "20:00",
        guests_count: 2,
        linked_group_id: groupId,
      });
      assertEquals(
        leg2.res.status,
        200,
        `leg2 unexpected status ${leg2.res.status}: ${JSON.stringify(leg2.json)}`,
      );
      assertEquals(leg2.json?.linked_group_id, groupId);

      // After the second insert, the function should report the first
      // leg as a sibling of the second.
      const siblings = leg2.json?.linked_siblings ?? [];
      assert(
        Array.isArray(siblings) && siblings.length >= 1,
        `leg2 must see at least one sibling; got ${JSON.stringify(siblings)}`,
      );
      const siblingIds = siblings.map((s: any) => s.id);
      assert(
        siblingIds.includes(leg1.json.reservation.id),
        `leg2 siblings must include leg1 id; got ${JSON.stringify(siblingIds)}`,
      );
      // Sibling rows should themselves carry the same group id.
      for (const s of siblings) {
        assertEquals(
          s.linked_group_id,
          groupId,
          `sibling ${s.id} has wrong linked_group_id`,
        );
      }

      // ---------- DB verification ----------
      // Both legs landed as separate rows with the shared group id.
      const filter =
        `tenant_id=eq.${TEST_TENANT_ID}` +
        `&guest_email=eq.${encodeURIComponent(guestEmail)}` +
        `&select=id,reservation_type,linked_group_id,status` +
        `&order=reservation_type.asc`;
      const { res: getRes, text: getText } = await adminFetch(
        `/reservations?${filter}`,
      );
      assertEquals(getRes.status, 200, `select failed: ${getText}`);
      const rows = JSON.parse(getText) as any[];
      assertEquals(
        rows.length,
        2,
        `expected 2 rows for cross-booking, got ${rows.length}: ${getText}`,
      );
      for (const r of rows) {
        assertEquals(
          r.linked_group_id,
          groupId,
          `row ${r.id} missing shared linked_group_id`,
        );
      }
      const types = rows.map((r) => r.reservation_type).sort();
      assertEquals(types, ["restaurant", "venue"]);
      // Each leg has a distinct id — they are separate rows, not one row.
      assert(
        rows[0].id !== rows[1].id,
        "cross-booking legs must be distinct reservation rows",
      );
    } finally {
      await cleanup();
      await assertEmpty();
    }
  },
});

Deno.test("public-booking: rejects malformed linked_group_id", async () => {
  const { res, json } = await callFn({
    tenant_id: TEST_TENANT_ID,
    guest_name: "Bad Group Test",
    guest_email: "ok@example.com",
    reservation_type: "restaurant",
    date: isoFutureDate(),
    start_time: "18:00",
    guests_count: 2,
    linked_group_id: "not-a-uuid",
  });
  assertEquals(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(json)}`);
  assert(
    typeof json?.error === "string" && /linked_group_id|uuid/i.test(json.error),
    `expected validation error mentioning linked_group_id, got: ${JSON.stringify(json)}`,
  );
});
