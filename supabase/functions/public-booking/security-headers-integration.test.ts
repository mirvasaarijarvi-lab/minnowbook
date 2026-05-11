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
      const ip = `10.0.0.${Math.floor(Math.random() * 250) + 4}`;
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
    } finally {
      restore();
    }
  }),
);
