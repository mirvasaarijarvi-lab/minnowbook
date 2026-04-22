/**
 * Tier-limit contract test for the admin-users edge function.
 *
 * Scenario under test:
 *   The dashboard's "Add user" flow calls admin-users { action: "create", … }.
 *   Internally, the function inserts a row into `tenant_users`. The
 *   `enforce_staff_user_limit` BEFORE-INSERT trigger fires; if the tenant
 *   has already reached its tier cap (Basic = 5, Professional = 25), it
 *   raises an exception with this exact shape:
 *
 *     'Tier "<tier>" allows at most <N> staff user(s).
 *      Upgrade your plan to add more.'
 *
 *   The dashboard's `parseTierLimitError` (src/lib/tier-error-codes.ts)
 *   keys off this prefix to produce a localized, user-friendly message
 *   with an upgrade CTA. If the edge function ever sanitized this
 *   message into the generic "An unexpected error occurred" copy,
 *   admins would lose the upgrade prompt entirely.
 *
 *   This test asserts the contract end-to-end at the response-builder
 *   layer: given the trigger's verbatim error, the JSON body the SPA
 *   receives must contain the EXACT trigger message, and the HTTP
 *   status must be 400 (the code the dashboard expects for actionable
 *   client errors).
 *
 *   We don't spin up Deno.serve, provision a real tenant, or hit the
 *   live database — the logic under test is the pipeline from a
 *   thrown error to the JSON response, which is now centralized in
 *   `buildErrorResponseBody`. Spinning up a real tenant and inserting
 *   5+ users to trigger the limit would be both slow and flaky, and
 *   would re-test Postgres rather than our function's contract.
 *
 *   The matching trigger SQL lives in:
 *     supabase/migrations/*  →  CREATE FUNCTION enforce_staff_user_limit
 *   and is also surfaced in the project's db-functions snapshot.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildErrorResponseBody,
  GENERIC_ERROR_MESSAGE,
} from "./sanitize-error.ts";

/**
 * Build an error object shaped like what the Supabase JS client returns
 * when the Postgres trigger raises an exception. The real shape from
 * postgrest-js is `{ message, code, details, hint }`; we mirror it so
 * the test mimics production exactly.
 */
function makeTriggerError(message: string) {
  return {
    name: "PostgrestError",
    message,
    code: "P0001", // standard Postgres "raise_exception" SQLSTATE
    details: null,
    hint: null,
  };
}

Deno.test(
  "Basic tier: staff-user-limit error reaches the UI verbatim with HTTP 400",
  () => {
    // Exact text raised by `enforce_staff_user_limit` for a Basic-tier
    // tenant (cap of 5). This must be byte-for-byte what the trigger
    // emits — see public.enforce_staff_user_limit() in db-functions.
    const triggerMessage =
      'Tier "basic" allows at most 5 staff user(s). Upgrade your plan to add more.';

    const { status, body } = buildErrorResponseBody(
      makeTriggerError(triggerMessage),
    );

    // 1. Status must be 400 — actionable client error, NOT a server 5xx.
    //    The dashboard treats 5xx as "system is broken, retry later"
    //    and 4xx as "show the user a useful message".
    assertEquals(
      status,
      400,
      "tier-limit failures must surface as HTTP 400 so the UI shows the upgrade prompt instead of a retry banner",
    );

    // 2. The error field in the JSON body must be the EXACT trigger
    //    message — parseTierLimitError matches on this verbatim.
    assertEquals(
      body.error,
      triggerMessage,
      "the trigger message must reach the UI unchanged so parseTierLimitError can map it to STAFF_USER_LIMIT_REACHED",
    );

    // 3. Defense-in-depth: it must NOT be replaced by the generic copy.
    //    A regression where this becomes generic would silently break
    //    the upgrade CTA without breaking any other test.
    assertEquals(
      body.error === GENERIC_ERROR_MESSAGE,
      false,
      "tier-limit message must never collapse into the generic 'unexpected error' copy",
    );

    // 4. Sanity: the code path the frontend keys off is present.
    assertStringIncludes(body.error, 'Tier "basic"');
    assertStringIncludes(body.error, "allows at most 5 staff user");
  },
);

Deno.test(
  "Professional tier: staff-user-limit error (cap of 25) is also forwarded verbatim",
  () => {
    // Same trigger, different tier — guards against accidentally
    // hard-coding "basic" anywhere in the sanitizer / response builder.
    const triggerMessage =
      'Tier "professional" allows at most 25 staff user(s). Upgrade your plan to add more.';

    const { status, body } = buildErrorResponseBody(
      makeTriggerError(triggerMessage),
    );

    assertEquals(status, 400);
    assertEquals(body.error, triggerMessage);
    assertStringIncludes(body.error, 'Tier "professional"');
    assertStringIncludes(body.error, "allows at most 25 staff user");
  },
);

Deno.test(
  "Trigger error wrapped in a real Error instance still surfaces verbatim",
  () => {
    // The admin-users edge function's catch block receives whichever
    // shape the call site threw. Some code paths re-throw via
    // `throw new Error(supabaseErr.message)`, so the response builder
    // must handle a plain Error too.
    const triggerMessage =
      'Tier "basic" allows at most 5 staff user(s). Upgrade your plan to add more.';

    const { status, body } = buildErrorResponseBody(new Error(triggerMessage));

    assertEquals(status, 400);
    assertEquals(body.error, triggerMessage);
  },
);

Deno.test(
  "Negative control: an internal Postgres error during user creation does NOT leak",
  () => {
    // Defensive counter-example. If a different DB error happens to
    // bubble up from the same insert (e.g. a unique-constraint or a
    // schema problem), it MUST be replaced with the generic copy and
    // logged server-side. This proves the previous tests aren't
    // passing because the sanitizer is a no-op.
    const internalMessage =
      'duplicate key value violates unique constraint "tenant_users_user_id_unique"';

    // Mute the server-side error log this code path emits so the test
    // output stays clean.
    const originalErr = console.error;
    console.error = () => {};
    try {
      const { status, body } = buildErrorResponseBody(
        makeTriggerError(internalMessage),
      );
      assertEquals(status, 400);
      assertEquals(body.error, GENERIC_ERROR_MESSAGE);
      // And critically: the raw constraint name must not be in the body.
      assertEquals(body.error.includes("tenant_users_user_id_unique"), false);
    } finally {
      console.error = originalErr;
    }
  },
);
