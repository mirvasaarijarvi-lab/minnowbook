// Integration test: invokes the `public-booking` request handler
// in-process with `SUPABASE_SERVICE_ROLE_KEY` intentionally unset,
// then asserts that BOTH the `reservations` and
// `booking_validation_log` tables have the exact same row count
// before and after the call.
//
// Why this exists:
//   * The unit tests in `service-role-guard.test.ts` already pin
//     the response shape (status 400, error_code), but they do not
//     touch the database at all.
//   * The "validation-only request leaves reservations row count
//     unchanged" test in `index.test.ts` covers the
//     `reservations` table only, and it triggers the *input
//     validation* error path (bad email) rather than the
//     missing-service-role-key path.
//
// This test closes both gaps: it runs the production code path
// for "service role key missing" and verifies the function
// performs ZERO writes to either DB-write target the function
// would normally touch.
//
// We need the service role key to issue authoritative `count=exact`
// queries against the two tables, so the key IS required to run
// this test. We capture it once, then unset `SUPABASE_SERVICE_ROLE_KEY`
// in the process env before invoking the handler so the in-handler
// `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` lookup returns
// undefined, exactly mirroring the production misconfig scenario.
// The original env value is restored in a `finally` block.
import "../_shared/load-env.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handlePublicBookingRequest } from "./index.ts";
import { BOOKING_ERROR_CODES } from "../_shared/booking-error-codes.ts";

function envOrEmpty(...names: string[]): string {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}

const SUPABASE_URL = envOrEmpty("SUPABASE_URL", "VITE_SUPABASE_URL");
const SERVICE_KEY = envOrEmpty("SUPABASE_SERVICE_ROLE_KEY");
const TEST_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";
const REST_URL = `${SUPABASE_URL}/rest/v1`;

/**
 * HEAD + Prefer: count=exact returns the authoritative row count in
 * the Content-Range header without streaming any rows. We scope the
 * `booking_validation_log` count to the seeded test tenant for the
 * same reason we do on `reservations`: to avoid noisy false positives
 * from unrelated tenants writing rows in parallel CI runs.
 */
async function countRows(table: string, tenantId: string): Promise<number> {
  const res = await fetch(
    `${REST_URL}/${table}?tenant_id=eq.${tenantId}&select=id`,
    {
      method: "HEAD",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  // HEAD responses have no body, but cancel defensively to keep
  // Deno's resource sanitizer happy across runtime versions.
  if (res.body && !res.bodyUsed) {
    try {
      await res.body.cancel();
    } catch {
      /* ignore */
    }
  }
  assert(
    res.status === 200 || res.status === 206,
    `count query for ${table} failed: status=${res.status}`,
  );
  const range = res.headers.get("content-range") ?? "";
  const total = range.split("/").pop();
  const n = total && total !== "*" ? Number.parseInt(total, 10) : NaN;
  assert(
    Number.isFinite(n) && n >= 0,
    `unparseable Content-Range for ${table}: "${range}"`,
  );
  return n;
}

Deno.test({
  name:
    "public-booking integration: missing SUPABASE_SERVICE_ROLE_KEY writes ZERO rows to reservations or booking_validation_log",
  // Need the real service role to issue authoritative count queries
  // and the real Supabase URL to even reach the REST endpoint. If
  // either is missing we cannot prove the invariant, so we skip
  // rather than silently pass.
  ignore: SERVICE_KEY.length === 0 || SUPABASE_URL.length === 0,
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    // 1. Capture authoritative baseline counts BEFORE we touch the env.
    const reservationsBefore = await countRows("reservations", TEST_TENANT_ID);
    const validationLogBefore = await countRows(
      "booking_validation_log",
      TEST_TENANT_ID,
    );

    // 2. Snapshot the current env value, then delete it so the handler
    //    sees exactly what production sees when the secret is missing.
    //    We restore in `finally` so a failed assertion below cannot
    //    leak the unset state into other tests in the same process.
    const originalKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    let response: Response | undefined;
    try {
      // 3. Invoke the real handler with a payload that, if the guard
      //    were missing, would otherwise be a fully valid booking and
      //    would write one row to `reservations` AND at least one row
      //    to `booking_validation_log`. The bad-input row-count test
      //    in `index.test.ts` deliberately uses an invalid payload, so
      //    this test deliberately uses a VALID one to exercise the
      //    "guard MUST short-circuit before any DB write" path.
      const futureDate = (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 21);
        return d.toISOString().slice(0, 10);
      })();
      const stamp = Date.now();
      const req = new Request("http://local-test/public-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: TEST_TENANT_ID,
          guest_name: `MissingKey Integration ${stamp}`,
          guest_email: `missing-key+${stamp}@mimmobook.test`,
          reservation_type: "restaurant",
          date: futureDate,
          start_time: "18:30",
          guests_count: 2,
        }),
      });

      response = await handlePublicBookingRequest(req);

      // 4. Pin the wire contract: 400 + structured error_code so the
      //    UI can route to the precise misconfig copy.
      assertEquals(
        response.status,
        400,
        `expected 400 from missing-service-key guard, got ${response.status}`,
      );
      const body = await response.json();
      assertEquals(
        body.error_code,
        BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
        `expected error_code=${BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING}, got ${body.error_code}`,
      );
    } finally {
      // 5. Always restore the env BEFORE the count queries below run,
      //    otherwise the count fetch would itself fail with 401.
      if (typeof originalKey === "string") {
        Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalKey);
      }
      // Drain the response body if the assertions threw before .json()
      // had a chance to consume it, so the resource sanitizer stays
      // clean.
      if (response && response.body && !response.bodyUsed) {
        try {
          await response.body.cancel();
        } catch {
          /* ignore */
        }
      }
    }

    // 6. Assert authoritative counts are byte-for-byte unchanged.
    //    A regression where the function writes to either table
    //    BEFORE the guard runs (or in an error branch) would tick
    //    one of these counts up by one and fail loudly here.
    const reservationsAfter = await countRows("reservations", TEST_TENANT_ID);
    const validationLogAfter = await countRows(
      "booking_validation_log",
      TEST_TENANT_ID,
    );

    assertEquals(
      reservationsAfter,
      reservationsBefore,
      `reservations row count changed when SUPABASE_SERVICE_ROLE_KEY was missing: ` +
        `before=${reservationsBefore}, after=${reservationsAfter}. ` +
        `The guard MUST short-circuit before ANY insert.`,
    );
    assertEquals(
      validationLogAfter,
      validationLogBefore,
      `booking_validation_log row count changed when SUPABASE_SERVICE_ROLE_KEY was missing: ` +
        `before=${validationLogBefore}, after=${validationLogAfter}. ` +
        `The guard MUST short-circuit before logValidation() runs.`,
    );
  },
});
