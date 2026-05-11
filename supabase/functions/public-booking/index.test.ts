// End-to-end tests for the `public-booking` edge function.
//
// Hits the deployed function URL with the project's anon key, then
// verifies the resulting reservation row via the service role.
//
// Run with: lovable test_edge_functions (or `deno test --allow-net --allow-env`)
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// The seeded "mimmin-testi" tenant from the production schema.
const TEST_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";

const FN_URL = `${SUPABASE_URL}/functions/v1/public-booking`;

function isoFutureDate(daysAhead = 14): string {
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
  } catch {
    /* leave as null */
  }
  return { res, json, text };
}

Deno.test("public-booking: rejects missing required fields", async () => {
  const { res, json } = await callFn({ tenant_id: TEST_TENANT_ID });
  assertEquals(res.status, 400, "expected 400 for missing required fields");
  assert(json?.error, "expected error message in response body");
});

Deno.test("public-booking: rejects bad email format", async () => {
  const { res, json } = await callFn({
    tenant_id: TEST_TENANT_ID,
    guest_name: "Test User",
    guest_email: "not-an-email",
    reservation_type: "restaurant",
    date: isoFutureDate(),
    guests_count: 2,
  });
  assertEquals(res.status, 400);
  assert(
    typeof json?.error === "string" && json.error.toLowerCase().includes("email"),
    `expected email error, got ${JSON.stringify(json)}`,
  );
});

Deno.test("public-booking: rejects unknown tenant", async () => {
  const { res, json } = await callFn({
    tenant_id: "00000000-0000-0000-0000-000000000000",
    guest_name: "Test User",
    guest_email: "ok@example.com",
    reservation_type: "restaurant",
    date: isoFutureDate(),
    guests_count: 2,
  });
  assertEquals(res.status, 400);
  assert(
    typeof json?.error === "string" && /tenant/i.test(json.error),
    `expected tenant error, got ${JSON.stringify(json)}`,
  );
});

Deno.test("public-booking: creates a pending reservation end-to-end", async () => {
  const stamp = Date.now();
  const guestName = `E2E Test ${stamp}`;
  const guestEmail = `e2e+${stamp}@mimmobook.test`;
  const date = isoFutureDate(21);

  const { res, json } = await callFn({
    tenant_id: TEST_TENANT_ID,
    guest_name: guestName,
    guest_email: guestEmail,
    reservation_type: "restaurant",
    date,
    start_time: "18:30",
    guests_count: 2,
  });

  assertEquals(res.status, 200, `unexpected status: ${res.status} ${JSON.stringify(json)}`);
  assertEquals(json?.success, true);

  // Verify the row landed with the expected defaults.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: row, error } = await admin
    .from("reservations")
    .select("id, status, tenant_id, guest_name, guest_email, date, reservation_type")
    .eq("tenant_id", TEST_TENANT_ID)
    .eq("guest_email", guestEmail)
    .maybeSingle();

  assertEquals(error, null);
  assert(row, "reservation row should exist");
  assertEquals(row!.status, "pending");
  assertEquals(row!.reservation_type, "restaurant");
  assertEquals(row!.date, date);
  assertEquals(row!.guest_name, guestName);

  // Cleanup so reruns stay isolated.
  await admin.from("reservations").delete().eq("id", row!.id);
});

Deno.test("schema: anon role cannot SELECT reservations directly (RLS)", async () => {
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await anon
    .from("reservations")
    .select("id")
    .eq("tenant_id", TEST_TENANT_ID)
    .limit(1);

  // RLS should yield either an error OR an empty result; never any rows.
  if (error) {
    assert(error.code, "expected RLS-style error");
  } else {
    assertEquals(data?.length ?? 0, 0, "anon must not read reservations");
  }
});
