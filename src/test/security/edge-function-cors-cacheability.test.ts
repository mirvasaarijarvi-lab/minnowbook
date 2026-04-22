/**
 * Edge Function CORS — forbidden-origin responses are NEVER cacheable
 *
 * A subtle CORS-cache pitfall: even when the server correctly refuses
 * to echo a forbidden Origin in `Access-Control-Allow-Origin`, an
 * intermediary cache (CDN, browser HTTP cache, corporate proxy) can
 * still poison subsequent requests if the response is cacheable and
 * not properly varied. For example:
 *   - A response with `Cache-Control: public, max-age=...` and no
 *     `Vary: Origin` could be served from cache to a *different* origin.
 *   - An OPTIONS preflight with a long `Access-Control-Max-Age` could
 *     train the browser to skip future preflights, hiding rotation of
 *     the allowlist.
 *
 * This file enforces the invariants below for both `admin-users` and
 * `support-chat`, on both preflight (OPTIONS) and actual (POST)
 * requests from a *forbidden* origin:
 *
 *   1. `Cache-Control` is present and explicitly non-cacheable
 *      (must contain `no-store`; must NOT contain `public`).
 *   2. `Vary` exists and includes `Origin` (case-insensitive),
 *      so any cache that *does* store the response keys it on Origin
 *      and never serves it to a different one.
 *   3. `Access-Control-Max-Age`, if present, is short (≤ 600s) so
 *      preflight decisions are revisited frequently.
 *   4. The response advertises itself as non-shareable: `Pragma: no-cache`
 *      is present (legacy HTTP/1.0 caches) and `Expires` is absent or 0.
 *   5. Status-line invariants from sibling tests still hold: ACAO does
 *      NOT echo the forbidden origin and is never `*`.
 *
 * Sibling files cover the request-side (admission control, header
 * reflection). This file covers the *response-cacheability* dimension.
 */
import "@/test/setup";
import { describe, it, expect } from "vitest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const FUNCTIONS = ["admin-users", "support-chat"] as const;

const FORBIDDEN_ORIGINS = [
  "https://evil.example.com",
  "https://attacker.test",
  "http://localhost.evil.com",
  "https://lovable.app.attacker.com",
  "https://notlovable.app",
  "https://lovable.app", // bare apex
  "http://minnowbook.lovable.app", // wrong scheme
  "null",
];

function fnUrl(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function preflight(name: string, origin: string) {
  return await fetch(fnUrl(name), {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type, apikey",
    },
  });
}

async function postCall(name: string, origin: string) {
  return await fetch(fnUrl(name), {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ action: "list" }),
  });
}

function expectNonCacheable(res: Response, label: string) {
  // --- Cache-Control ---
  const cc = (res.headers.get("cache-control") || "").toLowerCase();
  expect(cc, `${label}: Cache-Control header missing`).not.toBe("");
  expect(
    cc.includes("no-store"),
    `${label}: Cache-Control must include "no-store" (got "${cc}")`,
  ).toBe(true);
  expect(
    cc.includes("public"),
    `${label}: Cache-Control must NOT mark response as "public" (got "${cc}")`,
  ).toBe(false);
  // s-maxage > 0 would let a shared cache store this response.
  const sMaxage = cc.match(/s-maxage=(\d+)/);
  if (sMaxage) {
    expect(
      parseInt(sMaxage[1], 10),
      `${label}: shared cache TTL must be 0 (got ${sMaxage[1]})`,
    ).toBe(0);
  }
  const maxage = cc.match(/(?:^|[\s,])max-age=(\d+)/);
  if (maxage) {
    expect(
      parseInt(maxage[1], 10),
      `${label}: max-age must be 0 when present (got ${maxage[1]})`,
    ).toBe(0);
  }

  // --- Pragma (legacy) ---
  const pragma = (res.headers.get("pragma") || "").toLowerCase();
  expect(
    pragma.includes("no-cache"),
    `${label}: Pragma should include "no-cache" for legacy proxies (got "${pragma}")`,
  ).toBe(true);

  // --- Expires must not advertise a future cache lifetime ---
  const expires = res.headers.get("expires");
  if (expires !== null) {
    // Acceptable values: "0" or a date in the past.
    if (expires.trim() !== "0") {
      const t = Date.parse(expires);
      expect(
        Number.isFinite(t) && t <= Date.now(),
        `${label}: Expires must be 0 or in the past (got "${expires}")`,
      ).toBe(true);
    }
  }
}

function expectVariesByOrigin(res: Response, label: string) {
  const vary = (res.headers.get("vary") || "").toLowerCase();
  expect(vary, `${label}: Vary header missing`).not.toBe("");
  // Vary is a comma-separated list — accept any list containing Origin.
  const tokens = vary.split(",").map((t) => t.trim());
  expect(
    tokens.includes("origin") || tokens.includes("*"),
    `${label}: Vary must include "Origin" (got "${vary}")`,
  ).toBe(true);
}

function expectShortPreflightCache(res: Response, label: string) {
  const maxAge = res.headers.get("access-control-max-age");
  if (maxAge !== null) {
    const n = parseInt(maxAge, 10);
    expect(
      Number.isFinite(n) && n <= 600,
      `${label}: Access-Control-Max-Age must be ≤ 600s (got "${maxAge}")`,
    ).toBe(true);
  }
}

function expectNoOriginEcho(res: Response, forbidden: string, label: string) {
  const acao = res.headers.get("access-control-allow-origin");
  expect(
    acao === forbidden,
    `${label}: ACAO must not echo forbidden origin "${forbidden}" (got "${acao}")`,
  ).toBe(false);
  expect(acao).not.toBe("*");
}

describe("Forbidden origins — responses are never cacheable cross-origin", () => {
  for (const fn of FUNCTIONS) {
    describe(fn, () => {
      for (const origin of FORBIDDEN_ORIGINS) {
        it(`preflight from "${origin}" returns a non-cacheable response with Vary: Origin`, async () => {
          const res = await preflight(fn, origin);
          await res.text();
          const label = `${fn} OPTIONS ${origin}`;
          expectNonCacheable(res, label);
          expectVariesByOrigin(res, label);
          expectShortPreflightCache(res, label);
          expectNoOriginEcho(res, origin, label);
        });

        it(`POST from "${origin}" returns a non-cacheable response with Vary: Origin`, async () => {
          const res = await postCall(fn, origin);
          await res.text().catch(() => "");
          const label = `${fn} POST ${origin}`;
          expectNonCacheable(res, label);
          expectVariesByOrigin(res, label);
          expectNoOriginEcho(res, origin, label);
        });
      }

      it("repeated forbidden-origin probes return identical cache directives (no caching variance)", async () => {
        const probes = await Promise.all(
          Array.from({ length: 4 }, () =>
            preflight(fn, "https://evil.example.com"),
          ),
        );
        await Promise.all(probes.map((r) => r.text()));

        const fingerprints = probes.map((r) =>
          [
            r.headers.get("cache-control"),
            r.headers.get("vary"),
            r.headers.get("pragma"),
            r.headers.get("expires"),
            r.headers.get("access-control-max-age"),
          ].join(" | "),
        );
        expect(new Set(fingerprints).size).toBe(1);
      });

      it("forbidden-origin response carries no ETag/Last-Modified that would enable revalidation reuse", async () => {
        const res = await preflight(fn, "https://evil.example.com");
        await res.text();
        // These conditional-request enablers would let a cache hold a
        // stale entry across origins and revalidate on demand. Neither
        // should be present for a refusal response.
        expect(
          res.headers.get("etag"),
          `${fn}: ETag must not be set on a forbidden-origin response`,
        ).toBeNull();
        expect(
          res.headers.get("last-modified"),
          `${fn}: Last-Modified must not be set on a forbidden-origin response`,
        ).toBeNull();
      });
    });
  }
});
