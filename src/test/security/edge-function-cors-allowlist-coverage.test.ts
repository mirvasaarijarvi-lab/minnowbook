/**
 * Edge Function CORS — exhaustive allowlist coverage
 *
 * Iterates over the FULL configured allowed-origin list (literal strings
 * AND regex patterns) plus a deliberately broad set of disallowed
 * variants (http/https confusion, subdomain spoofing, suffix injection,
 * port appendage, case games, trailing dots, etc.) and verifies that
 * `Access-Control-Allow-Origin` is echoed iff and only if the origin
 * actually matches the allowlist.
 *
 * Source of truth — kept in sync with both edge functions:
 *   ALLOWED_ORIGINS = [
 *     "https://minnowbook.lovable.app",
 *     /^https:\/\/.*\.lovable\.app$/,
 *   ]
 *
 * Tested edge functions: admin-users, support-chat.
 */
import "@/test/setup";
import { describe, it, expect } from "vitest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const FUNCTIONS = ["admin-users", "support-chat"] as const;

// Mirror of the edge functions' allowlist. If the function-side list
// changes, update this and the assertions below.
const ALLOWED_ORIGINS: Array<string | RegExp> = [
  "https://minnowbook.lovable.app",
  // Mirror of the function-side regex — DNS-safe chars only, rejects
  // userinfo/ports/paths so things like `https://attacker@x.lovable.app`
  // do NOT match.
  /^https:\/\/[a-zA-Z0-9.-]+\.lovable\.app$/,
];
// The literal fallback that disallowed origins should be normalized to.
const CANONICAL_FALLBACK = "https://minnowbook.lovable.app";

function isAllowed(origin: string): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin),
  );
}

// -------- Allowed origins (positive cases) --------
// Concrete examples covering both the literal entry and the regex entry.
const ALLOWED_VARIANTS: string[] = [
  // Exact literal match
  "https://minnowbook.lovable.app",
  // Regex matches: every *.lovable.app https subdomain
  "https://id-preview--9a20e2f8-6afb-44fa-9973-d36be40f1b95.lovable.app",
  "https://some-other-project.lovable.app",
  "https://a.lovable.app",
  "https://staging.lovable.app",
  "https://very-long-subdomain-name-with-dashes.lovable.app",
  "https://abc123.lovable.app",
  // Multi-level subdomain — current regex `.*\.lovable\.app$` accepts these.
  "https://a.b.lovable.app",
];

// -------- Disallowed origin variants (negative cases) --------
// http/https confusion, subdomain/suffix injection, port appendage,
// trailing-dot tricks, case games, fragments/queries.
const DISALLOWED_VARIANTS: string[] = [
  // Wrong scheme
  "http://minnowbook.lovable.app",
  "http://anything.lovable.app",
  "ftp://minnowbook.lovable.app",
  "ws://minnowbook.lovable.app",
  // Bare apex — not a *.lovable.app subdomain
  "https://lovable.app",
  "http://lovable.app",
  // Suffix / host-confusion injection
  "https://lovable.app.attacker.com",
  "https://minnowbook.lovable.app.attacker.com",
  "https://notlovable.app",
  "https://evil-lovable.app", // same TLD shape, different second-level
  "https://lovableXapp", // typosquat without dot
  // Port appendages — Origin headers normally don't include the default
  // port, but explicit ports must NOT match.
  "https://minnowbook.lovable.app:8443",
  "https://anything.lovable.app:8080",
  // Trailing dot (FQDN form) — must not bypass exact-string match.
  "https://minnowbook.lovable.app.",
  // Userinfo trick
  "https://attacker@minnowbook.lovable.app",
  // Case games — Origin matching is case-sensitive on host per spec/impl.
  "https://MINNOWBOOK.LOVABLE.APP",
  "https://Anything.Lovable.App",
  // Path/query/fragment in Origin (invalid but worth probing)
  "https://minnowbook.lovable.app/evil",
  "https://minnowbook.lovable.app?x=1",
  "https://minnowbook.lovable.app#frag",
  // Unrelated origins
  "https://evil.example.com",
  "https://attacker.test",
  "http://localhost.evil.com",
  "https://localhost",
  "https://127.0.0.1",
  // Sandboxed iframe / file://
  "null",
  // Empty
  "",
];

function fnUrl(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function preflight(name: string, origin: string) {
  const headers: Record<string, string> = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization, content-type, apikey",
  };
  if (origin !== "") headers["Origin"] = origin;
  return await fetch(fnUrl(name), { method: "OPTIONS", headers });
}

// -------- Sanity checks on local allowlist mirror --------
describe("Allowlist mirror sanity (local matcher reflects function logic)", () => {
  for (const o of ALLOWED_VARIANTS) {
    it(`local matcher accepts allowed: ${o}`, () => {
      expect(isAllowed(o)).toBe(true);
    });
  }
  for (const o of DISALLOWED_VARIANTS) {
    it(`local matcher rejects disallowed: ${o || "(empty)"}`, () => {
      expect(isAllowed(o)).toBe(false);
    });
  }
});

// -------- Live edge-function probes --------
describe("Edge function CORS — exhaustive allowed/disallowed origin coverage", () => {
  for (const fn of FUNCTIONS) {
    describe(fn, () => {
      // Allowed origins must be echoed verbatim (case + scheme preserved).
      for (const origin of ALLOWED_VARIANTS) {
        it(`echoes ALLOWED origin "${origin}" in ACAO`, async () => {
          const res = await preflight(fn, origin);
          await res.text();
          const acao = res.headers.get("access-control-allow-origin");
          expect(
            acao,
            `${fn}: expected ACAO to equal "${origin}", got "${acao}"`,
          ).toBe(origin);
          // Wildcard would also be unsafe for an authenticated flow.
          expect(acao).not.toBe("*");
          // Credentials must remain unset for our cookieless model.
          const acac = res.headers.get("access-control-allow-credentials");
          if (acac !== null) expect(acac.toLowerCase()).not.toBe("true");
        });
      }

      // Disallowed origins must NEVER be echoed. The function's documented
      // behavior is to fall back to the canonical literal entry.
      for (const origin of DISALLOWED_VARIANTS) {
        it(`does NOT echo DISALLOWED origin "${origin || "(empty)"}" in ACAO`, async () => {
          const res = await preflight(fn, origin);
          await res.text();
          const acao = res.headers.get("access-control-allow-origin");

          // Hard invariants regardless of fallback strategy:
          if (origin !== "") {
            expect(
              acao === origin,
              `${fn}: ACAO must not echo disallowed "${origin}" (got "${acao}")`,
            ).toBe(false);
          }
          expect(acao).not.toBe("*");

          // Documented fallback: when present, it equals the canonical
          // first allowlist entry. (We allow null/missing too, in case
          // a future revision drops the header for disallowed origins.)
          if (acao !== null) {
            expect(acao).toBe(CANONICAL_FALLBACK);
          }

          // Credentials never enabled for disallowed origins.
          const acac = res.headers.get("access-control-allow-credentials");
          if (acac !== null) expect(acac.toLowerCase()).not.toBe("true");
        });
      }

      it("hardening headers are present on every preflight regardless of origin", async () => {
        const sample = [...ALLOWED_VARIANTS.slice(0, 2), ...DISALLOWED_VARIANTS.slice(0, 3)];
        for (const origin of sample) {
          const res = await preflight(fn, origin);
          await res.text();
          expect(res.headers.get("x-content-type-options")).toBe("nosniff");
          expect(res.headers.get("x-frame-options")).toBe("DENY");
          expect(res.headers.get("referrer-policy")).toBe(
            "strict-origin-when-cross-origin",
          );
        }
      });

      it("no allowed-variant accidentally also matches a disallowed-variant pattern", () => {
        // Defense-in-depth: if our two lists ever drift and overlap, this
        // surfaces it before live tests get confusing.
        const overlap = ALLOWED_VARIANTS.filter((o) =>
          DISALLOWED_VARIANTS.includes(o),
        );
        expect(overlap).toEqual([]);
      });
    });
  }
});
