// Integration test that actually invokes the public-booking handler
// in-process with mocked requests and asserts every 4xx/5xx Response
// carries the shared SECURITY_HEADERS triad (HSTS, Referrer-Policy,
// CSP, etc).
//
// This complements the static `public-booking-response-headers.test.ts`
// scanner: that one greps the source for `...corsHeaders` spreads, this
// one drives real Request objects through the exported handler and
// inspects the resulting Response.headers, so a future regression that
// e.g. forgets to spread the bag, or returns a `new Response()` from a
// helper without the headers, fails loudly here regardless of how the
// source happens to be formatted.
//
// Runs entirely in-process: no network, no deployed function URL, no
// real Supabase client. The createClient hook is stubbed so the
// invalid-JSON path never touches the network.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  _publicBookingTestHooks,
  handlePublicBookingRequest,
} from "./index.ts";
import { SECURITY_HEADERS } from "../_shared/http-headers.ts";
import { assertCspAndHsts } from "../_shared/test-security-headers.ts";

/** Headers that MUST appear on every Response, success or error. */
const REQUIRED_HEADER_ENTRIES = Object.entries(SECURITY_HEADERS);

function assertSecurityHeaders(res: Response, label: string) {
  for (const [name, expected] of REQUIRED_HEADER_ENTRIES) {
    const actual = res.headers.get(name);
    assertEquals(
      actual,
      expected,
      `[${label}] response is missing or mismatched header "${name}". ` +
        `expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    );
  }
}

async function drainBody(res: Response) {
  if (res.body && !res.bodyUsed) {
    try {
      await res.body.cancel();
    } catch {
      /* ignore */
    }
  }
}

/** Stub the createClient hook so 4xx paths that run AFTER the
 *  key-check (e.g. invalid JSON, 429 rate-limit) never instantiate a
 *  real network-bound client. The handler immediately falls into the
 *  try/catch and returns 400 before touching the stub anyway. */
function stubCreateClient() {
  const original = _publicBookingTestHooks.createClient;
  _publicBookingTestHooks.createClient = (() => ({})) as any;
  return () => {
    _publicBookingTestHooks.createClient = original;
  };
}

function withServiceRoleKey<T>(fn: () => Promise<T>): () => Promise<T> {
  return async () => {
    const prev = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    Deno.env.set("SUPABASE_URL", Deno.env.get("SUPABASE_URL") ?? "https://stub.supabase.co");
    try {
      return await fn();
    } finally {
      if (typeof prev === "string") Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prev);
      else Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    }
  };
}

function withoutServiceRoleKey<T>(fn: () => Promise<T>): () => Promise<T> {
  return async () => {
    const prev = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.set("SUPABASE_URL", Deno.env.get("SUPABASE_URL") ?? "https://stub.supabase.co");
    try {
      return await fn();
    } finally {
      if (typeof prev === "string") Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prev);
    }
  };
}

Deno.test(
  "security headers: OPTIONS preflight response carries SECURITY_HEADERS",
  async () => {
    const req = new Request("https://example.test/public-booking", {
      method: "OPTIONS",
    });
    const res = await handlePublicBookingRequest(req);
    await drainBody(res);
    assertSecurityHeaders(res, "OPTIONS preflight");
    assertCspAndHsts(res, "OPTIONS preflight");
  },
);

Deno.test(
  "security headers: 400 SERVICE_ROLE_KEY_MISSING response carries SECURITY_HEADERS",
  withoutServiceRoleKey(async () => {
    const req = new Request("https://example.test/public-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.0.0.1",
      },
      body: JSON.stringify({
        tenant_id: "00000000-0000-0000-0000-000000000000",
        guest_name: "x",
        guest_email: "x@example.com",
        reservation_type: "restaurant",
        date: "2099-01-01",
      }),
    });
    const res = await handlePublicBookingRequest(req);
    const body = await res.json();
    assertEquals(res.status, 400);
    assertEquals(body.error_code, "SERVICE_ROLE_KEY_MISSING");
    assertSecurityHeaders(res, "400 SERVICE_ROLE_KEY_MISSING");
    assertCspAndHsts(res, "400 SERVICE_ROLE_KEY_MISSING");
  }),
);

Deno.test(
  "security headers: 413 oversize-body response carries SECURITY_HEADERS",
  withServiceRoleKey(async () => {
    const restore = stubCreateClient();
    try {
      const req = new Request("https://example.test/public-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "60000",
          "x-forwarded-for": "10.0.0.2",
        },
        body: JSON.stringify({ tenant_id: "x" }),
      });
      const res = await handlePublicBookingRequest(req);
      await drainBody(res);
      assertEquals(res.status, 413);
      assertSecurityHeaders(res, "413 Request too large");
      assertCspAndHsts(res, "413 Request too large");
    } finally {
      restore();
    }
  }),
);

Deno.test(
  "security headers: 400 invalid-JSON response carries SECURITY_HEADERS",
  withServiceRoleKey(async () => {
    const restore = stubCreateClient();
    try {
      const req = new Request("https://example.test/public-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.3",
        },
        body: "{ this is not valid json",
      });
      const res = await handlePublicBookingRequest(req);
      const text = await res.text();
      assertEquals(res.status, 400);
      assert(text.length > 0, "expected error JSON body, got empty");
      assertSecurityHeaders(res, "400 invalid JSON");
      assertCspAndHsts(res, "400 invalid JSON");
    } finally {
      restore();
    }
  }),
);

Deno.test(
  "security headers: 429 rate-limit response carries SECURITY_HEADERS",
  withServiceRoleKey(async () => {
    const restore = stubCreateClient();
    try {
      // The rate-limit check runs BEFORE the service-role-key guard and
      // BEFORE any DB work. Drive 6 requests from the same IP; the 6th
      // one MUST come back as 429.
      //
      // Use a FIXED, namespaced IP rather than `Math.random()` so the
      // test is fully deterministic. The other tests in this file use
      // 10.0.0.1 to 10.0.0.3; this one is pinned to 10.0.0.250 to stay
      // out of that range and to keep its own rate-limit bucket
      // isolated even if the in-memory limiter state leaks across
      // tests in the same Deno process.
      const ip = "10.0.0.250";
      let last: Response | undefined;
      for (let i = 0; i < 6; i++) {
        const req = new Request("https://example.test/public-booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: "{}",
        });
        last = await handlePublicBookingRequest(req);
        if (last.status !== 429) await drainBody(last);
      }
      assert(last, "no response captured");
      assertEquals(last!.status, 429, "6th request from same IP must be rate-limited");
      await drainBody(last!);
      assertSecurityHeaders(last!, "429 rate-limit");
      assertCspAndHsts(last!, "429 rate-limit");
    } finally {
      restore();
    }
  }),
);

// ---------------------------------------------------------------------------
// 2xx success path
// ---------------------------------------------------------------------------
//
// The 4xx/5xx assertions above only prove the security headers ride
// along when the handler short-circuits. They cannot catch a regression
// where the *success* response (the only one a real guest ever sees)
// silently drops the bag — e.g. a refactor that builds the 200 body via
// `new Response(body, { headers: { "Content-Type": "application/json" } })`
// without spreading `corsHeaders`. This test installs a fake
// service-role Supabase client so the entire happy path runs in-process,
// and asserts the resulting 2xx response carries the same SECURITY_HEADERS
// triad + bag as every error path.

/** Build a chainable fake Postgrest builder. Every chain method
 *  returns the same proxy; awaiting the proxy (or calling `.single()`
 *  / `.maybeSingle()`) resolves to the supplied fixture. */
function makeBuilder(fixture: { data: any; error: any }) {
  const proxy: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: any) => void) => resolve(fixture);
      }
      if (prop === "single" || prop === "maybeSingle") {
        return () => {
          const data = Array.isArray(fixture.data)
            ? (fixture.data[0] ?? null)
            : fixture.data;
          return Promise.resolve({ data, error: fixture.error });
        };
      }
      // Any other chain method (select / eq / in / neq / not / order /
      // limit / etc.) just returns the same proxy so awaits at the end
      // of any chain length resolve identically.
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

/** Minimal stub of the createClient return value covering only the
 *  shape that public-booking touches on the success path. */
function makeFakeAdminClient(reservationId: string) {
  return {
    from(table: string) {
      const fixtures: Record<string, { data: any; error: any }> = {
        // computeCapacity reads resources, then the existing-bookings
        // count. Empty arrays mean capacity_total = 0, current_load = 0
        // and the function falls into the "capacity undefined" branch
        // which permits the booking unconditionally.
        resources: { data: [], error: null },
        reservations: { data: [], error: null },
        // Tenant must exist and be active.
        tenants: {
          data: {
            id: "00000000-0000-0000-0000-000000000001",
            name: "Test Tenant",
            is_active: true,
            allowed_reservation_types: [],
          },
          error: null,
        },
        booking_validation_log: { data: null, error: null },
        tenant_settings: { data: null, error: null },
        site_settings: { data: null, error: null },
        email_unsubscribe_tokens: {
          data: { token: "stub-unsub-token" },
          error: null,
        },
      };

      return {
        select: (..._a: unknown[]) => makeBuilder(fixtures[table] ?? { data: [], error: null }),
        // The reservations insert is the one place we MUST return a row
        // with `id` so the rest of the success path can read it.
        insert: (..._a: unknown[]) =>
          makeBuilder(
            table === "reservations"
              ? { data: { id: reservationId }, error: null }
              : (fixtures[table] ?? { data: null, error: null }),
          ),
        update: (..._a: unknown[]) => makeBuilder(fixtures[table] ?? { data: null, error: null }),
        upsert: (..._a: unknown[]) => makeBuilder(fixtures[table] ?? { data: null, error: null }),
      };
    },
    // enqueue_email RPC is awaited but its return is ignored.
    rpc: (..._a: unknown[]) => Promise.resolve({ data: null, error: null }),
  };
}

Deno.test(
  "security headers: 200 success response carries SECURITY_HEADERS",
  withServiceRoleKey(async () => {
    const RESERVATION_ID = "11111111-2222-3333-4444-555555555555";
    const original = _publicBookingTestHooks.createClient;
    _publicBookingTestHooks.createClient = (() =>
      makeFakeAdminClient(RESERVATION_ID)) as any;
    try {
      const req = new Request("https://example.test/public-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Use a fresh IP so the in-memory rate-limiter (shared across
          // tests in this file) doesn't 429 us on the way in.
          "x-forwarded-for": "10.0.0.200",
        },
        body: JSON.stringify({
          tenant_id: "00000000-0000-0000-0000-000000000001",
          guest_name: "Success Guest",
          guest_email: "success@example.com",
          reservation_type: "restaurant",
          date: "2099-01-01",
        }),
      });
      const res = await handlePublicBookingRequest(req);
      const body = await res.json();

      assertEquals(res.status, 200, `expected 200 success, got ${res.status}`);
      assertEquals(
        body.success,
        true,
        `expected success body, got ${JSON.stringify(body)}`,
      );

      // Same exhaustive assertions used on every error path: the
      // success response must ship the FULL SECURITY_HEADERS bag, and
      // CSP + HSTS must match SECURITY_HEADERS byte-for-byte.
      assertSecurityHeaders(res, "200 success");
      assertCspAndHsts(res, "200 success");

      // And the Content-Type must still be JSON, so the security
      // headers are coexisting with the real success payload (not
      // accidentally overwriting it).
      assertEquals(res.headers.get("Content-Type"), "application/json");
    } finally {
      _publicBookingTestHooks.createClient = original;
    }
  }),
);
