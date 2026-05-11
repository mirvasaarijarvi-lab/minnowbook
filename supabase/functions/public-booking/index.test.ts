// End-to-end tests for the `public-booking` edge function.
//
// Hits the deployed function URL with the project's anon key, then
// verifies the resulting reservation row via the service role when
// available. Uses raw fetch (not the supabase-js client) to avoid the
// auth-refresh interval that triggers Deno test "leaks detected".
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// The seeded "mimmin-testi" tenant from the production schema.
const TEST_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";

const FN_URL = `${SUPABASE_URL}/functions/v1/public-booking`;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

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

async function adminFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${REST_URL}${path}`, { ...init, headers });
  const text = await res.text();
  return { res, text };
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

  if (!SERVICE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping DB verification step.");
    return;
  }

  // Verify the row landed with the expected defaults.
  const filter = `tenant_id=eq.${TEST_TENANT_ID}&guest_email=eq.${encodeURIComponent(guestEmail)}`;
  const { res: getRes, text: getText } = await adminFetch(
    `/reservations?${filter}&select=id,status,reservation_type,date,guest_name`,
  );
  assertEquals(getRes.status, 200, `select failed: ${getText}`);
  const rows = JSON.parse(getText) as any[];
  assertEquals(rows.length, 1, `expected 1 row, got ${rows.length}`);
  const row = rows[0];
  assertEquals(row.status, "pending");
  assertEquals(row.reservation_type, "restaurant");
  assertEquals(row.date, date);
  assertEquals(row.guest_name, guestName);

  // Cleanup so reruns stay isolated.
  await adminFetch(`/reservations?id=eq.${row.id}`, { method: "DELETE" });
});

Deno.test("schema: anon role cannot SELECT reservations directly (RLS)", async () => {
  const res = await fetch(
    `${REST_URL}/reservations?tenant_id=eq.${TEST_TENANT_ID}&select=id&limit=1`,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
    },
  );
  const text = await res.text();
  // RLS should yield either an error response OR an empty array; never any rows.
  if (res.ok) {
    const rows = JSON.parse(text);
    assertEquals(
      Array.isArray(rows) ? rows.length : -1,
      0,
      "anon must not read reservations",
    );
  } else {
    assert(res.status >= 400, `expected RLS-style failure, got ${res.status}`);
  }
});
