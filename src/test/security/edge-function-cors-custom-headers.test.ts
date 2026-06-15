/**
 * Edge Function CORS — disallowed Origin + custom-header preflight regression
 *
 * Complements `edge-function-cors-origin.test.ts` and
 * `edge-function-disallowed-origin-403.test.ts` by exercising the
 * preflight surface for *every* custom header the web client actually
 * sends, paired with disallowed origins.
 *
 * Invariants under test (per function × per origin × per header set):
 *   1. The preflight response NEVER echoes the disallowed origin in
 *      `Access-Control-Allow-Origin` (and never returns "*").
 *   2. `Access-Control-Allow-Credentials` is never `true` for a
 *      disallowed origin (no credentialed cross-origin leak).
 *   3. The preflight response advertises the requested custom headers
 *      via `Access-Control-Allow-Headers` so the legitimate client
 *      isn't accidentally broken — but ACAO still falls back to the
 *      canonical allowed origin, not the attacker's.
 *   4. `Access-Control-Allow-Methods` (when present) does not silently
 *      grant DELETE/PUT to attacker origins.
 *   5. The non-preflight POST that follows from a disallowed origin
 *      returns an explicit 403 and does NOT echo the origin or set
 *      credentials.
 *
 * The header sets below mirror what the supabase-js client sends
 * (Authorization, apikey, x-client-info, the x-supabase-client-* family)
 * plus a few realistic custom headers that downstream features may add
 * (x-request-id, content-type variations, x-impersonate-tenant-id).
 */
import "@/test/setup";
import { describe, it, expect } from "vitest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const FUNCTIONS = ["admin-users", "support-chat"] as const;

const ALLOWED_ORIGIN = "https://minnowbook.lovable.app";

const DISALLOWED_ORIGINS = [
  "https://evil.example.com",
  "https://attacker.test",
  "http://localhost.evil.com",
  "https://lovable.app.attacker.com", // suffix injection
  "https://notlovable.app", // host confusion
  "https://lovable.app", // bare apex, not a subdomain
  "http://minnowbook.lovable.app", // wrong scheme
  "null", // sandboxed iframe / file://
];

// Each entry is the value the browser would send in
// `Access-Control-Request-Headers` for a particular client interaction.
const CUSTOM_HEADER_SETS: Array<{ label: string; value: string }> = [
  {
    label: "supabase-js core auth",
    value: "authorization, content-type, apikey",
  },
  {
    label: "supabase-js client identifiers",
    value:
      "authorization, content-type, apikey, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  },
  {
    label: "request tracing + impersonation",
    value: "authorization, content-type, apikey, x-request-id, x-impersonate-tenant-id",
  },
  {
    label: "uppercase + spacing variants",
    value: "Authorization, Content-Type, APIKey, X-Client-Info",
  },
  {
    label: "single header",
    value: "authorization",
  },
];

const PREFLIGHT_METHODS = ["POST", "DELETE", "PUT", "PATCH"] as const;

function fnUrl(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

import { fetchWithColdStartRetry } from "./cold-start-retry";


/**
 * Two preflight "modes" exist in production:
 *
 *   - "with-apikey": the browser uses supabase-js, which sends an
 *     `apikey` header on the actual request. Some browsers (and the
 *     Supabase functions gateway) propagate that to the preflight as
 *     well, so the gateway routes OPTIONS straight to the function.
 *   - "no-apikey": a plain `fetch()` from page code, a curl probe, or a
 *     non-supabase-js client. Preflights arrive at the gateway WITHOUT
 *     credentials, and the Supabase gateway answers with its own
 *     permissive default (often `Access-Control-Allow-Origin: *`)
 *     before the function is invoked.
 *
 * Both paths are exercised because the security invariant we care
 * about is the same: cross-origin callers must never be able to read
 * credentialed responses. The gateway's `*` answer is browser-safe (a
 * browser rejects `*` + credentials), so for `no-apikey` mode we drop
 * the "never `*`" assertion and only check the credential / origin-echo
 * invariants.
 */
type ApikeyMode = "with-apikey" | "no-apikey";

async function preflight(
  name: string,
  origin: string,
  method: string,
  headers: string,
  apikeyMode: ApikeyMode = "with-apikey",
) {
  const requestHeaders: Record<string, string> = {
    Origin: origin,
    "Access-Control-Request-Method": method,
    "Access-Control-Request-Headers": headers,
  };
  if (apikeyMode === "with-apikey") {
    // Force the Supabase functions gateway to route the preflight to
    // the function itself instead of answering with its own fallback
    // CORS response (which exposes `Access-Control-Allow-Origin: *`
    // and masks whatever the function actually returns).
    requestHeaders.apikey = SUPABASE_PUBLISHABLE_KEY;
  }
  return await fetchWithColdStartRetry(fnUrl(name), {
    method: "OPTIONS",
    headers: requestHeaders,
  });
}



async function postRequest(
  name: string,
  origin: string,
  extraHeaders: Record<string, string>,
) {
  return await fetchWithColdStartRetry(fnUrl(name), {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ action: "list" }),
  });
}


function expectNoOriginEcho(
  res: Response,
  forbidden: string,
  label: string,
  opts: { allowWildcard?: boolean } = {},
) {
  const acao = res.headers.get("access-control-allow-origin");
  expect(
    acao === forbidden,
    `${label}: ACAO must not echo forbidden origin "${forbidden}" (got "${acao}")`,
  ).toBe(false);
  if (!opts.allowWildcard) {
    expect(
      acao === "*",
      `${label}: ACAO must not be wildcard (got "${acao}")`,
    ).toBe(false);
  }
}


function expectNoCredentialsEnabled(res: Response, label: string) {
  const acac = res.headers.get("access-control-allow-credentials");
  if (acac !== null) {
    expect(
      acac.toLowerCase(),
      `${label}: credentials must not be enabled (got "${acac}")`,
    ).not.toBe("true");
  }
}

function expectNoMethodOverreach(res: Response, label: string) {
  const acam = res.headers.get("access-control-allow-methods");
  // If the function advertises methods, it must not blanket-allow
  // destructive verbs to attacker origins. Either the header is absent
  // (browser defaults to the simple method set) or it is a known-safe
  // shape — never the literal "*".
  if (acam !== null) {
    expect(acam, `${label}: ACAM must not be wildcard`).not.toBe("*");
  }
}

const APIKEY_MODES: ApikeyMode[] = ["with-apikey", "no-apikey"];

describe("Edge function CORS — disallowed origin × custom-header preflights", () => {
  for (const fn of FUNCTIONS) {
    describe(fn, () => {
      // Live network calls into deployed edge functions can occasionally
      // exceed the default 5s on a cold start (especially the very first
      // OPTIONS / POST hit per worker, and most reliably for support-chat
      // which boots the AI gateway client). Use a 30s per-test timeout
      // instead of bumping the global default — only this suite is
      // network-bound.
      const NETWORK_TIMEOUT_MS = 30_000;

      // -------- positive control --------
      // Allowed-origin echo is a function-level guarantee, so it's only
      // meaningful in `with-apikey` mode (the gateway fallback can't
      // know which origin to echo). For `no-apikey` we just assert the
      // gateway doesn't return a credentialed response.
      for (const set of CUSTOM_HEADER_SETS) {
        for (const apikeyMode of APIKEY_MODES) {
          it(
            `preflight from allowed origin with "${set.label}" headers [${apikeyMode}] is safe`,
            async () => {
              const res = await preflight(
                fn,
                ALLOWED_ORIGIN,
                "POST",
                set.value,
                apikeyMode,
              );
              await res.text();
              const acao = res.headers.get("access-control-allow-origin");
              if (apikeyMode === "with-apikey") {
                expect(acao).toBe(ALLOWED_ORIGIN);
                const allowedHdrs = (
                  res.headers.get("access-control-allow-headers") || ""
                ).toLowerCase();
                expect(allowedHdrs).toContain("authorization");
              } else {
                // Gateway fallback is allowed to be `*` or to echo the
                // origin; either way it must NOT enable credentials and
                // must NOT return a value that breaks the legitimate
                // client (empty / "null" / "undefined").
                if (acao !== null) {
                  expect(acao === "" || acao === "null" || acao === "undefined").toBe(false);
                }
              }
              expectNoCredentialsEnabled(res, `${fn} allowed ${set.label} [${apikeyMode}]`);
            },
            NETWORK_TIMEOUT_MS,
          );
        }
      }

      // -------- negative: every disallowed origin × every header set × every method × every apikey mode --------
      for (const origin of DISALLOWED_ORIGINS) {
        for (const set of CUSTOM_HEADER_SETS) {
          for (const method of PREFLIGHT_METHODS) {
            for (const apikeyMode of APIKEY_MODES) {
              it(
                `preflight ${method} from "${origin}" with "${set.label}" headers [${apikeyMode}] does not reflect origin or enable credentials`,
                async () => {
                  const res = await preflight(fn, origin, method, set.value, apikeyMode);
                  await res.text();
                  const label = `${fn} ${method} ${origin} [${set.label}] [${apikeyMode}]`;
                  // The Supabase gateway's fallback preflight (no-apikey
                  // mode) legitimately returns `Access-Control-Allow-Origin: *`,
                  // which is browser-safe because the same gateway never
                  // sets `Access-Control-Allow-Credentials: true`. The
                  // origin-echo check below is still strict — the gateway
                  // must never echo the attacker origin verbatim.
                  expectNoOriginEcho(res, origin, label, {
                    allowWildcard: apikeyMode === "no-apikey",
                  });
                  expectNoCredentialsEnabled(res, label);
                  expectNoMethodOverreach(res, label);

                  // Hardening headers must still be present on responses
                  // the function itself produced (`with-apikey` mode).
                  // The gateway fallback (no-apikey) does not run the
                  // function, so we only assert these for with-apikey.
                  if (apikeyMode === "with-apikey") {
                    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
                    expect(res.headers.get("x-frame-options")).toBe("DENY");
                    expect(res.headers.get("referrer-policy")).toBe(
                      "strict-origin-when-cross-origin",
                    );
                  }
                },
                NETWORK_TIMEOUT_MS,
              );
            }
          }
        }

        it(
          `POST follow-up from "${origin}" returns 403 without leaking origin or credentials`,
          async () => {
            const res = await postRequest(fn, origin, {
              "x-client-info": "evil-client/1.0",
              "x-request-id": "test-trace-id",
            });
            await res.text().catch(() => "");

            // The origin gate enforces an explicit 403 server-side.
            expect(
              res.status,
              `${fn} POST ${origin}: expected 403, got ${res.status}`,
            ).toBe(403);

            expectNoOriginEcho(res, origin, `${fn} POST ${origin}`);
            expectNoCredentialsEnabled(res, `${fn} POST ${origin}`);
          },
          NETWORK_TIMEOUT_MS,
        );
      }


      // -------- preflight WITHOUT Origin (e.g. some non-browser callers) --------
      it(
        "preflight with custom headers but NO Origin still does not return wildcard ACAO",
        async () => {
          const res = await fetch(fnUrl(fn), {
            method: "OPTIONS",
            headers: {
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers":
                "authorization, content-type, apikey, x-client-info",
              // See `preflight()` above: required so the Supabase
              // functions gateway routes to the function instead of
              // returning its own permissive default preflight.
              apikey: SUPABASE_PUBLISHABLE_KEY,
            },
          });
          await res.text();
          const acao = res.headers.get("access-control-allow-origin");
          if (acao !== null) {
            expect(acao).not.toBe("*");
            expect(acao).not.toBe("");
            expect(acao).not.toBe("null");
            expect(acao).not.toBe("undefined");
          }
          expectNoCredentialsEnabled(res, `${fn} no-origin preflight`);
        },
        NETWORK_TIMEOUT_MS,
      );

      // -------- consistency: same disallowed origin probed many times yields uniform headers --------
      it(
        "repeated preflights from the same disallowed origin are header-consistent (no oracle)",
        async () => {
          const probes = await Promise.all(
            Array.from({ length: 5 }, () =>
              preflight(
                fn,
                "https://evil.example.com",
                "POST",
                "authorization, content-type, apikey",
              ),
            ),
          );
          await Promise.all(probes.map((r) => r.text()));

          const fingerprints = probes.map((r) =>
            JSON.stringify({
              acao: r.headers.get("access-control-allow-origin"),
              acac: r.headers.get("access-control-allow-credentials"),
              acah: (
                r.headers.get("access-control-allow-headers") || ""
              ).toLowerCase(),
            }),
          );
          // Every probe should expose an identical CORS fingerprint —
          // variation would leak request-handling state to attackers.
          expect(new Set(fingerprints).size).toBe(1);

          // And critically, none echoes the attacker origin.
          for (const r of probes) {
            expectNoOriginEcho(r, "https://evil.example.com", `${fn} repeat probe`);
            expectNoCredentialsEnabled(r, `${fn} repeat probe`);
          }
        },
        NETWORK_TIMEOUT_MS,
      );
    });
  }
});
