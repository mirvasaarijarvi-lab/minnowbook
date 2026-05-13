/**
 * Integration tests for the `forbidden-status` edge function.
 *
 * Contract under test (mirrors the function's docblock):
 *   - GET / POST → HTTP 403 with `application/json` body
 *   - The body echoes the `?area=` query param in the message
 *   - When `?area=` is missing, falls back to the literal phrase
 *     "this area" so monitoring assertions stay stable
 *   - OPTIONS preflight → HTTP 204 with permissive CORS headers
 *   - All responses include `Access-Control-Allow-Origin: *` so the
 *     SPA can call this from any tenant subdomain without CORS errors
 *   - Cache-Control is `no-store` so intermediaries don't cache the 403
 *
 * These tests hit the deployed function over HTTPS — they do not spawn
 * a local Deno.serve. That keeps the assertions honest about what
 * production actually returns (status code, headers, JSON shape).
 *
 * Why this matters: the SPA shell at `/superadmin` is served as
 * `index.html` with HTTP 200, so the document itself can never carry
 * a 403. The Forbidden page beacons this function to put a real,
 * monitorable 403 in the network log. Synthetic checks and audit
 * pipelines depend on that 403 staying truthful.
 */

import "../_shared/load-env.ts";
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
if (!SUPABASE_URL) {
  throw new Error(
    "VITE_SUPABASE_URL is not set — required to test the forbidden-status edge function",
  );
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/forbidden-status`;

// The function is deliberately auth-free (verify_jwt = false). Anonymous
// callers should always see 403 — which is the very signal the page is
// trying to surface to monitoring.
Deno.test(
  "GET forbidden-status returns HTTP 403 with the JSON denial body",
  async () => {
    const res = await fetch(`${FUNCTION_URL}?area=the%20Superadmin%20area`, {
      method: "GET",
    });

    // The headline assertion: a real, observable 403 status code.
    assertEquals(
      res.status,
      403,
      "function must always respond with HTTP 403 — synthetic monitoring depends on this",
    );

    const contentType = res.headers.get("content-type") ?? "";
    assertStringIncludes(contentType, "application/json");

    // Permissive CORS so the SPA can call from any tenant subdomain.
    assertEquals(res.headers.get("access-control-allow-origin"), "*");

    // Crawlers and CDNs must not cache a 403 — otherwise a transient
    // denial could be served to a user who is actually authorized.
    assertEquals(res.headers.get("cache-control"), "no-store");

    const body = await res.json();
    assertEquals(body.status, 403);
    assertEquals(body.error, "forbidden");
    // The message echoes the requested area so audit logs and screenshots
    // can correlate the 403 entry with the route the user tried to reach.
    assertStringIncludes(body.message, "the Superadmin area");
  },
);

Deno.test(
  "GET forbidden-status without ?area= falls back to 'this area'",
  async () => {
    const res = await fetch(FUNCTION_URL, { method: "GET" });
    assertEquals(res.status, 403);
    const body = await res.json();
    assertStringIncludes(body.message, "this area");
  },
);

Deno.test(
  "POST forbidden-status also returns 403 (method-agnostic denial)",
  async () => {
    const res = await fetch(`${FUNCTION_URL}?area=audit%20log`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ignored: true }),
    });
    assertEquals(res.status, 403);
    const body = await res.json();
    assertStringIncludes(body.message, "audit log");
  },
);

Deno.test(
  "OPTIONS preflight returns HTTP 204 with the documented CORS headers",
  async () => {
    const res = await fetch(FUNCTION_URL, {
      method: "OPTIONS",
      headers: {
        // Mirror what a browser preflight from the SPA would send.
        origin: "https://app.example.com",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization, content-type",
      },
    });

    // Consume body to avoid resource leak warnings even though it's empty.
    await res.text();

    assertEquals(res.status, 204, "preflight must succeed without a body");

    // The function declares its allowed methods/headers explicitly so the
    // browser will allow the subsequent real request through.
    assertEquals(res.headers.get("access-control-allow-origin"), "*");
    const allowMethods = res.headers.get("access-control-allow-methods") ?? "";
    assertStringIncludes(allowMethods, "GET");
    assertStringIncludes(allowMethods, "OPTIONS");
    const allowHeaders = res.headers.get("access-control-allow-headers") ?? "";
    assertStringIncludes(allowHeaders, "authorization");
    assertStringIncludes(allowHeaders, "content-type");
  },
);

Deno.test(
  "Repeated calls always return 403 — no rate-limit or auth bypass",
  async () => {
    // Five back-to-back calls to confirm the function is stateless and
    // never accidentally upgrades to a 2xx (e.g. via a future cache miss).
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(`${FUNCTION_URL}?area=probe`, { method: "GET" }),
      ),
    );

    for (const res of responses) {
      assertEquals(res.status, 403);
      // Drain the body — Deno requires it to release the connection.
      const body = await res.json();
      assert(body.message);
    }
  },
);
