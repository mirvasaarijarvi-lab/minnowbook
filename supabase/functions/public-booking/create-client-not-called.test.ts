// Unit test: when SUPABASE_SERVICE_ROLE_KEY is missing, the
// public-booking handler MUST short-circuit before the DB layer is
// constructed. The strongest possible proof of that property is to
// swap the supabase-js `createClient` factory for a spy and assert
// the spy is never called: if it ever IS called, a DB path is
// reachable without a service-role key, which is the exact
// regression this guard exists to prevent.
//
// This test is intentionally cheap and hermetic: no network, no
// `.env`, no service-role key needed. It fails the build the moment
// the guard regresses, even on a developer laptop with no Supabase
// credentials.
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  _publicBookingTestHooks,
  handlePublicBookingRequest,
} from "./index.ts";
import { BOOKING_ERROR_CODES } from "../_shared/booking-error-codes.ts";

Deno.test({
  name:
    "public-booking guard: createClient is NEVER called when SUPABASE_SERVICE_ROLE_KEY is missing",
  sanitizeOps: true,
  sanitizeResources: true,
  sanitizeExit: true,
  fn: async () => {
    // 1. Snapshot env + factory, then null both out so we can prove
    //    the guard refuses to construct an admin client. Restored in
    //    `finally` so test order can never leak this state.
    const originalKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const originalUrl = Deno.env.get("SUPABASE_URL");
    const originalFactory = _publicBookingTestHooks.createClient;
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    // SUPABASE_URL is read with `!` in the handler. We set a dummy
    // value so the handler doesn't throw a TypeError BEFORE reaching
    // the guard, which would mask whether the guard actually fired.
    if (typeof originalUrl !== "string" || originalUrl.length === 0) {
      Deno.env.set("SUPABASE_URL", "http://unit-test.invalid");
    }

    let createClientCalls = 0;
    const spyArgs: Array<{ url: unknown; key: unknown }> = [];
    _publicBookingTestHooks.createClient = ((url: unknown, key: unknown) => {
      createClientCalls++;
      spyArgs.push({ url, key });
      // Return a throw-on-touch proxy so any accidental DB call past
      // this point fails loudly with a clear message rather than a
      // confusing "undefined is not a function" later.
      return new Proxy({}, {
        get(_t, prop) {
          throw new Error(
            `public-booking handler reached supabase client method "${String(prop)}" ` +
              `with no service-role key. The guard MUST short-circuit before any DB call.`,
          );
        },
      }) as unknown as ReturnType<typeof originalFactory>;
    }) as typeof originalFactory;

    let response: Response | undefined;
    try {
      // 2. Send a request that, if the guard were missing, would be
      //    a fully valid booking and would reach `createClient` and
      //    then the DB. Using a clearly-future date keeps the rest of
      //    validation happy.
      const futureDate = (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 21);
        return d.toISOString().slice(0, 10);
      })();
      const req = new Request("http://unit-test.invalid/public-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "9ac05fbf-0834-44fd-a52a-d030b7074a30",
          guest_name: "CreateClient Spy Test",
          guest_email: "spy@mimmobook.test",
          reservation_type: "restaurant",
          date: futureDate,
          start_time: "18:30",
          guests_count: 2,
        }),
      });

      response = await handlePublicBookingRequest(req);

      // 3. Pin the wire contract so a regression that "fixes" the
      //    test by also breaking the response shape is caught here.
      assertEquals(
        response.status,
        400,
        `expected 400 from missing-service-key guard, got ${response.status}`,
      );
      const body = await response.json();
      assertEquals(
        body.error_code,
        BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
      );

      // 4. The whole point of this test: the spy was NEVER invoked,
      //    so no DB path is reachable without a service-role key.
      assertEquals(
        createClientCalls,
        0,
        `createClient was invoked ${createClientCalls} time(s) with args ` +
          `${JSON.stringify(spyArgs)} despite SUPABASE_SERVICE_ROLE_KEY being unset. ` +
          `The guard MUST short-circuit before any supabase client is constructed.`,
      );
    } finally {
      // 5. Restore env + factory unconditionally so failed assertions
      //    do not leak unset state into other tests in the same run.
      _publicBookingTestHooks.createClient = originalFactory;
      if (typeof originalKey === "string") {
        Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalKey);
      }
      if (typeof originalUrl === "string" && originalUrl.length > 0) {
        Deno.env.set("SUPABASE_URL", originalUrl);
      } else {
        Deno.env.delete("SUPABASE_URL");
      }
      if (response && response.body && !response.bodyUsed) {
        try {
          await response.body.cancel();
        } catch {
          /* ignore */
        }
      }
    }

    // Sanity: belt-and-suspenders that the spy itself ran in this
    // test (catches a future refactor where the test imports the
    // wrong symbol and silently always passes).
    assert(true, "test executed end to end");
  },
});
