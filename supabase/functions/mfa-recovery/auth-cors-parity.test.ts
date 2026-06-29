// Integration test: `mfa-recovery` (the MFA recovery-codes endpoint)
// MUST return HTTP 401 when the Authorization header is missing or
// malformed, AND that 401 response MUST advertise the exact same
// CORS / security headers as the OPTIONS preflight. Drift between
// the two bags previously caused browsers to surface the preflight
// as "ok" but then block the 401 because `Access-Control-Allow-*`
// values didn't match — leaving the UI stuck on a generic
// "Failed to fetch" with no usable signal.
//
// This file is complementary to:
//   - `_shared/auth-401-contract.test.ts`  (latency + status contract)
//   - `security-headers-integration.test.ts` (per-status-code header bag)
// and locks in the *parity* invariant specifically for the headers a
// browser preflight inspects.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleMfaRecoveryRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

const ORIGIN = "https://mimmobook.com";

/** Header names that a browser CORS preflight + actual request must
 *  see agree on. If any of these drift between OPTIONS and the 401,
 *  the browser will block the response before the SPA can read it. */
const CORS_HEADER_NAMES = [
  "Access-Control-Allow-Origin",
  "Access-Control-Allow-Headers",
  "Access-Control-Allow-Methods",
  "Access-Control-Allow-Credentials",
  "Access-Control-Max-Age",
  "Vary",
] as const;

function snapshotCors(res: Response): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const name of CORS_HEADER_NAMES) out[name] = res.headers.get(name);
  return out;
}

async function preflight(): Promise<Response> {
  const req = new Request("https://example.test/mfa-recovery", {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type, apikey",
    },
  });
  return await handleMfaRecoveryRequest(req);
}

interface AuthScenario {
  label: string;
  headers: Record<string, string>;
}

const SCENARIOS: AuthScenario[] = [
  { label: "missing Authorization", headers: {} },
  {
    label: "non-Bearer Authorization",
    headers: { Authorization: "Basic dXNlcjpwYXNz" },
  },
  {
    label: "Bearer with empty token",
    headers: { Authorization: "Bearer    " },
  },
  {
    label: "Bearer with garbage token (not three JWT segments)",
    headers: { Authorization: "Bearer not.a.jwt.token.shape" },
  },
];

async function post(headers: Record<string, string>): Promise<Response> {
  const req = new Request("https://example.test/mfa-recovery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...headers,
    },
    body: JSON.stringify({}),
  });
  return await handleMfaRecoveryRequest(req);
}

Deno.test({
  name: "mfa-recovery: OPTIONS preflight advertises a usable CORS bag",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: withStubSupabaseEnv(async () => {
    const res = await preflight();
    await drainBody(res);
    await drainBody(res);

    // Preflight is itself a success — browsers ignore 2xx vs 204 but
    // require non-5xx, and the full security-headers bag must ship.
    assert(
      res.status >= 200 && res.status < 300,
      `preflight returned non-2xx status ${res.status}`,
    );
    assertSharedHeaders(res, "OPTIONS preflight");
    assertCspAndHsts(res, "OPTIONS preflight");

    // The two CORS headers a browser actually evaluates must be set.
    const origin = res.headers.get("Access-Control-Allow-Origin");
    const allowHeaders = res.headers.get("Access-Control-Allow-Headers");
    assert(origin, "preflight missing Access-Control-Allow-Origin");
    assert(
      allowHeaders && /authorization/i.test(allowHeaders),
      `preflight Access-Control-Allow-Headers must whitelist "authorization", got ${JSON.stringify(allowHeaders)}`,
    );
  }),
);

for (const { label, headers } of SCENARIOS) {
  Deno.test(
    `mfa-recovery: ${label} -> 401 with CORS headers identical to preflight`,
    withStubSupabaseEnv(async () => {
      const preflightRes = await preflight();
      await drainBody(preflightRes);
      const preflightCors = snapshotCors(preflightRes);

      const res = await post(headers);
      await drainBody(res);

      assertEquals(
        res.status,
        401,
        `${label}: expected HTTP 401, got ${res.status}`,
      );

      // Full security bag must be present on the 401 (regression
      // guard against partial CORS headers on the error path).
      assertSharedHeaders(res, `401 (${label})`);
      assertCspAndHsts(res, `401 (${label})`);

      // Byte-exact parity against the preflight for every CORS-relevant
      // header. This is the invariant browsers enforce.
      const errorCors = snapshotCors(res);
      for (const name of CORS_HEADER_NAMES) {
        assertEquals(
          errorCors[name],
          preflightCors[name],
          `${label}: "${name}" must match the OPTIONS preflight exactly. ` +
            `preflight=${JSON.stringify(preflightCors[name])} ` +
            `401=${JSON.stringify(errorCors[name])}`,
        );
      }

      // JSON content-type so the SPA can parse the error envelope.
      const ct = res.headers.get("Content-Type") ?? "";
      assert(
        ct.toLowerCase().includes("application/json"),
        `${label}: expected JSON Content-Type on 401, got "${ct}"`,
      );
    }),
  );
}
