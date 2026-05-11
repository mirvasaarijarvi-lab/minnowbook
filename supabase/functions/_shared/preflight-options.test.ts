// OPTIONS preflight contract tests.
//
// Every browser-facing edge function must respond to a CORS preflight
// (`OPTIONS` with `Access-Control-Request-Method` set) by returning:
//
//   1. The full SECURITY_HEADERS triad + bag (HSTS, Referrer-Policy,
//      CSP, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
//      Cache-Control, Pragma, Vary).
//   2. The expected CORS headers: Allow-Origin (echoed for allowlisted
//      origins, omitted for disallowed ones, "*" for wildcard
//      endpoints), Allow-Headers, and (when configured) Allow-Methods.
//
// Two layers of coverage:
//
//   - Direct unit coverage of `getCorsHeaders` and the static
//     `corsHeaders` bag, which feed every function's preflight branch.
//   - Integration coverage that drives a real handler
//     (`public-booking`) with an OPTIONS request and asserts the
//     resulting Response carries everything above. This catches
//     regressions where a handler stops spreading the bag, returns a
//     bare `new Response()`, or short-circuits before the security
//     headers are attached.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  corsHeaders,
  DEFAULT_ALLOW_HEADERS,
  DEFAULT_ALLOWED_ORIGINS,
  getCorsHeaders,
  SECURITY_HEADERS,
} from "./http-headers.ts";
import { assertSharedHeaders, drainBody } from "./test-security-headers.ts";
import { handlePublicBookingRequest } from "../public-booking/index.ts";

const ALLOWED_ORIGIN = "https://mimmobook.com";
const DISALLOWED_ORIGIN = "https://evil.example.com";

function preflight(origin: string, method = "POST"): Request {
  return new Request("https://stub.functions.local/fn", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": "authorization, content-type",
    },
  });
}

// --- Unit: getCorsHeaders --------------------------------------------------

Deno.test("getCorsHeaders: allowed origin echoes Origin and sets full SECURITY_HEADERS", () => {
  const headers = getCorsHeaders(preflight(ALLOWED_ORIGIN), {
    allowMethods: "GET, POST, OPTIONS",
  });

  // CORS contract.
  assertEquals(headers["Access-Control-Allow-Origin"], ALLOWED_ORIGIN);
  assertEquals(headers["Access-Control-Allow-Headers"], DEFAULT_ALLOW_HEADERS);
  assertEquals(headers["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
  // Allow-Headers must include the auth/content-type pair the browser
  // will send on the real request.
  assertStringIncludes(headers["Access-Control-Allow-Headers"], "authorization");
  assertStringIncludes(headers["Access-Control-Allow-Headers"], "content-type");
  assertStringIncludes(headers["Access-Control-Allow-Headers"], "apikey");

  // Security triad + bag is present and unchanged.
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    assertEquals(
      headers[name],
      expected,
      `missing/mismatched "${name}" on preflight allowed-origin response`,
    );
  }
});

Deno.test("getCorsHeaders: disallowed origin omits Allow-Origin but keeps SECURITY_HEADERS", () => {
  const headers = getCorsHeaders(preflight(DISALLOWED_ORIGIN), {
    allowMethods: "GET, POST, OPTIONS",
  });

  assertEquals(
    headers["Access-Control-Allow-Origin"],
    undefined,
    "disallowed origin must NOT receive an Access-Control-Allow-Origin header; " +
      "the browser will block the response, which is the desired behaviour.",
  );
  // Methods/Headers may still be advertised; the browser will simply
  // block the response because the origin check failed first.
  assertEquals(headers["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
  assertEquals(headers["Access-Control-Allow-Headers"], DEFAULT_ALLOW_HEADERS);

  // Security headers must still be present even on the rejected
  // preflight, so any cached response is still locked down.
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    assertEquals(headers[name], expected, `missing "${name}" on disallowed-origin preflight`);
  }
});

Deno.test("getCorsHeaders: wildcard mode sets Allow-Origin: *", () => {
  const headers = getCorsHeaders(preflight(DISALLOWED_ORIGIN), {
    allowOrigins: "*",
    allowMethods: "POST, OPTIONS",
  });
  assertEquals(headers["Access-Control-Allow-Origin"], "*");
  assertEquals(headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    assertEquals(headers[name], expected);
  }
});

Deno.test("getCorsHeaders: every DEFAULT_ALLOWED_ORIGINS entry is honoured", () => {
  // Pick deterministic samples for each pattern in the allowlist so a
  // future regex tightening that accidentally drops one fails here.
  const samples = [
    "https://minnowbook.lovable.app",
    "https://mimmobook.com",
    "https://www.mimmobook.com",
    "https://abc-preview.lovable.app",
    "https://xyz.lovableproject.com",
    "https://tenant.mimmobook.com",
  ];
  for (const origin of samples) {
    const headers = getCorsHeaders(preflight(origin));
    assertEquals(
      headers["Access-Control-Allow-Origin"],
      origin,
      `allowlist regression: ${origin} should be echoed back`,
    );
  }
  // Spot-check the type contract too.
  assert(DEFAULT_ALLOWED_ORIGINS.length > 0);
});

// --- Unit: static corsHeaders bag (used by wildcard endpoints) -------------

Deno.test("corsHeaders static bag carries CORS + SECURITY_HEADERS", () => {
  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*");
  assertEquals(corsHeaders["Access-Control-Allow-Headers"], DEFAULT_ALLOW_HEADERS);
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    assertEquals(corsHeaders[name], expected, `static corsHeaders missing "${name}"`);
  }
});

// --- Integration: real handler OPTIONS path --------------------------------
//
// public-booking is the canonical wildcard-CORS function and short-
// circuits OPTIONS at the very top of its handler. Driving it
// in-process with a real Request validates the contract end-to-end.

Deno.test("public-booking OPTIONS preflight returns CORS + SECURITY_HEADERS", async () => {
  const res = await handlePublicBookingRequest(preflight(ALLOWED_ORIGIN));
  try {
    // Preflight responses are conventionally 200 or 204 with no body.
    assert(
      res.status === 200 || res.status === 204,
      `expected 200/204 on OPTIONS, got ${res.status}`,
    );

    // CORS contract.
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    assertEquals(
      res.headers.get("Access-Control-Allow-Headers"),
      DEFAULT_ALLOW_HEADERS,
    );

    // Full SECURITY_HEADERS bag (triad + framing + cache).
    assertSharedHeaders(res, "public-booking OPTIONS");
  } finally {
    await drainBody(res);
  }
});

Deno.test(
  "public-booking OPTIONS from a disallowed origin still ships SECURITY_HEADERS",
  async () => {
    // public-booking uses the wildcard `corsHeaders` bag, so even a
    // disallowed origin gets `Allow-Origin: *`. The contract we assert
    // here is the SECURITY_HEADERS floor, which must hold regardless
    // of origin so cached responses can't be downgraded.
    const res = await handlePublicBookingRequest(preflight(DISALLOWED_ORIGIN));
    try {
      assert(res.status === 200 || res.status === 204);
      assertSharedHeaders(res, "public-booking OPTIONS (disallowed origin)");
    } finally {
      await drainBody(res);
    }
  },
);
