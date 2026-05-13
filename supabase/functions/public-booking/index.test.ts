// End-to-end tests for the `public-booking` edge function.
//
// Hits the deployed function URL with the project's anon key, then
// verifies the resulting reservation row via the service role when
// available. Uses raw fetch (not the supabase-js client) to avoid the
// auth-refresh interval that triggers Deno test "leaks detected".
import "../_shared/load-env.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeReservationCleanup } from "../_shared/test-cleanup.ts";
import {
  assertFunctionError,
  assertMissingServiceKeyResponse,
} from "../_shared/test-assert.ts";

function requireEnv(...names: string[]): string {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  throw new Error(
    `Missing required env var. Set one of: ${names.join(", ")} ` +
      `(check your .env file is loaded and the value is non-empty).`,
  );
}

const SUPABASE_URL = requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
const ANON_KEY = requireEnv(
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
);

// Service role key is optional: tests that need DB verification will skip
// when it is absent. We still trim and treat empty strings as "missing"
// so we never pass an empty supabaseKey into createClient or REST headers.
const SERVICE_KEY = (() => {
  const raw = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : "";
})();

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
  const result = await callFn({ tenant_id: TEST_TENANT_ID });
  assertFunctionError(result, { status: 400, label: "missing required fields" });
});

Deno.test("public-booking: rejects bad email format", async () => {
  const result = await callFn({
    tenant_id: TEST_TENANT_ID,
    guest_name: "Test User",
    guest_email: "not-an-email",
    reservation_type: "restaurant",
    date: isoFutureDate(),
    guests_count: 2,
  });
  assertFunctionError(result, {
    status: 400,
    errorIncludes: "email",
    label: "bad email format",
  });
});

Deno.test("public-booking: rejects unknown tenant", async () => {
  const result = await callFn({
    tenant_id: "00000000-0000-0000-0000-000000000000",
    guest_name: "Test User",
    guest_email: "ok@example.com",
    reservation_type: "restaurant",
    date: isoFutureDate(),
    guests_count: 2,
  });
  assertFunctionError(result, {
    status: 400,
    errorMatch: /tenant/i,
    label: "unknown tenant",
  });
});

Deno.test("public-booking: creates a pending reservation end-to-end", async () => {
  const stamp = Date.now();
  const guestName = `E2E Test ${stamp}`;
  const guestEmail = `e2e+${stamp}@mimmobook.test`;
  const date = isoFutureDate(21);

  // Cleanup + post-cleanup verification are centralized in
  // ../_shared/test-cleanup.ts so every reservation test gets the same
  // hardened semantics (representation parsing, retry, multi-row sweep,
  // and a final assertEmpty() guard).
  const { cleanup, assertEmpty } = makeReservationCleanup({
    adminFetch,
    tenantId: TEST_TENANT_ID,
    guestEmail,
    hasServiceKey: SERVICE_KEY.length > 0,
  });

  try {
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
      console.warn("SUPABASE_SERVICE_ROLE_KEY not set, skipping DB verification step.");
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
  } finally {
    await cleanup();
    await assertEmpty();
  }
});

Deno.test({
  name: "schema: anon role cannot SELECT reservations directly (RLS)",
  // Be explicit so any future supabase-js usage (which spawns auth-refresh
  // intervals) trips the leak detector immediately.
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    // Use AbortController so the underlying connection is torn down
    // deterministically even if an assertion throws below.
    const controller = new AbortController();
    let res: Response | undefined;
    let text = "";
    try {
      res = await fetch(
        `${REST_URL}/reservations?tenant_id=eq.${TEST_TENANT_ID}&select=id&limit=1`,
        {
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
          signal: controller.signal,
        },
      );
      // Always drain the body, in both ok and error branches, before asserting.
      text = await res.text();

      // RLS should yield either an error response OR an empty array; never any rows.
      if (res.ok) {
        let rows: unknown;
        try {
          rows = JSON.parse(text);
        } catch {
          rows = null;
        }
        assertEquals(
          Array.isArray(rows) ? rows.length : -1,
          0,
          `anon must not read reservations, body=${text}`,
        );
      } else {
        assert(res.status >= 400, `expected RLS-style failure, got ${res.status}`);
      }
    } finally {
      // If fetch threw mid-flight, make sure the request is cancelled and any
      // unread body is dropped so Deno's resource sanitizer stays clean.
      if (!res) {
        controller.abort();
      } else if (res.body && !res.bodyUsed) {
        try {
          await res.body.cancel();
        } catch {
          /* ignore */
        }
      }
    }
  },
});

// When SUPABASE_SERVICE_ROLE_KEY is unavailable we cannot DELETE rows via the
// REST API, so any test that inserts data would leak rows on the seeded
// tenant. This test guarantees that path is handled safely:
//   * The insert is intentionally NOT attempted (we send an invalid payload
//     that the function rejects with 400 before any row is written).
//   * The test logs an explicit "skipping cleanup" message so CI surfaces the
//     fact that destructive verification was bypassed.
// When the service key IS configured the broader e2e test above already
// covers the happy path, so this test is ignored.
Deno.test({
  name: "public-booking: no data leak when SUPABASE_SERVICE_ROLE_KEY is missing",
  ignore: SERVICE_KEY.length > 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY not set, skipping cleanup-capable insert; " +
        "running validation-only request so no reservation row is created.",
    );

    // Bad email triggers the function's input validation and short-circuits
    // before any DB write, so there is nothing to clean up afterwards.
    const result = await callFn({
      tenant_id: TEST_TENANT_ID,
      guest_name: "Cleanup-Skip Test",
      guest_email: "not-an-email",
      reservation_type: "restaurant",
      date: isoFutureDate(),
      guests_count: 2,
    });

    assertMissingServiceKeyResponse(
      result,
      "no data leak when service role key missing",
    );
  },
});

// Quantitative companion to "no data leak when SUPABASE_SERVICE_ROLE_KEY is
// missing": queries the reservations table with the service role BEFORE and
// AFTER the same validation-failing request, then asserts the row count is
// byte-for-byte unchanged. This catches a subtler regression than just
// asserting `res.status === 400`: if the function ever started writing a
// row before validation (or as part of an error path), the status check
// would still pass but the count would tick up by one.
//
// We need the service role to issue an authoritative `count=exact` query,
// so this test is ignored when the key isn't configured. The key isn't
// passed into `callFn` itself — the function call uses the anon key
// exactly like a real public booking request would, mirroring the
// "missing service key" production scenario.
Deno.test({
  name: "public-booking: validation-only request leaves reservations row count unchanged",
  ignore: SERVICE_KEY.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    // Use HEAD + Prefer: count=exact so we get the authoritative total in
    // the Content-Range header without paying for a full row payload (the
    // table may have many rows on shared CI tenants).
    async function tenantReservationCount(): Promise<number> {
      const res = await fetch(
        `${REST_URL}/reservations?tenant_id=eq.${TEST_TENANT_ID}&select=id`,
        {
          method: "HEAD",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: "count=exact",
            // Range: 0-0 keeps PostgREST from streaming any rows back even
            // though HEAD already drops the body; belt and suspenders.
            Range: "0-0",
          },
        },
      );
      // HEAD responses have no body, but call .body?.cancel() defensively
      // to keep Deno's resource sanitizer happy across runtimes.
      if (res.body && !res.bodyUsed) {
        try { await res.body.cancel(); } catch { /* ignore */ }
      }
      assert(
        res.status === 200 || res.status === 206,
        `count query failed: status=${res.status}`,
      );
      // Content-Range looks like "0-0/1234" or "*/1234" when no rows match.
      const range = res.headers.get("content-range") ?? "";
      const total = range.split("/").pop();
      const n = total && total !== "*" ? Number.parseInt(total, 10) : NaN;
      assert(
        Number.isFinite(n) && n >= 0,
        `unparseable Content-Range: "${range}"`,
      );
      return n;
    }

    const before = await tenantReservationCount();

    // Same validation-failing payload as the "missing service key" test
    // above: the bad email triggers the function's input validation and
    // MUST short-circuit before any DB write.
    const result = await callFn({
      tenant_id: TEST_TENANT_ID,
      guest_name: "Count-Invariant Test",
      guest_email: "not-an-email",
      reservation_type: "restaurant",
      date: isoFutureDate(),
      guests_count: 2,
    });

    assertFunctionError(result, {
      status: 400,
      label: "validation-only request",
    });

    const after = await tenantReservationCount();

    assertEquals(
      after,
      before,
      `reservations row count changed across a validation-only request: ` +
        `before=${before}, after=${after}. The function MUST NOT insert a ` +
        `row when input validation fails (or when SUPABASE_SERVICE_ROLE_KEY ` +
        `is missing in production).`,
    );
  },
});
