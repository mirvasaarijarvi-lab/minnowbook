/**
 * Edge Function CORS Origin Allowlist Tests
 *
 * Verifies that edge functions which implement an Origin allowlist
 * (admin-users, support-chat) correctly handle disallowed/forbidden Origins:
 *
 *   1. The response NEVER echoes the disallowed origin in
 *      `Access-Control-Allow-Origin` — i.e. the browser will block the
 *      response from being read by attacker-controlled pages.
 *   2. `Access-Control-Allow-Credentials` is not set to `true` for
 *      disallowed origins (no credential leak).
 *   3. Preflight (OPTIONS) responses still return security headers so
 *      that the contract is consistent — but the ACAO value falls back
 *      to the canonical app origin, not the attacker's.
 *   4. Non-preflight requests from a forbidden origin do not return
 *      data: either the response status is non-2xx (auth/validation
 *      failure as expected without a session), or, if 2xx, the ACAO
 *      header still does not match the forbidden origin — meaning the
 *      browser would never expose the body cross-origin.
 *
 * NOTE: Edge runtimes do NOT block requests purely based on the Origin
 * header — CORS is enforced by the *browser*. The defense is to never
 * emit `Access-Control-Allow-Origin: <attacker>`. That is what these
 * tests verify against the live deployment.
 */
import "@/test/setup";
import { describe, it, expect } from "vitest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Origins that MUST never be reflected back by the allowlist.
const FORBIDDEN_ORIGINS = [
  "https://evil.example.com",
  "https://attacker.test",
  "http://localhost.evil.com",
  "https://lovable.app.attacker.com", // suffix-injection attempt
  "https://notlovable.app", // host-confusion attempt
  "null", // sandboxed iframe / file://
];

// Origins that the allowlist explicitly permits — used as a positive control.
const ALLOWED_ORIGIN = "https://minnowbook.lovable.app";

const FUNCTIONS = ["admin-users", "support-chat"] as const;

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

async function postCall(name: string, origin: string, body: unknown) {
  return await fetch(fnUrl(name), {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

function expectNoOriginEcho(res: Response, forbidden: string, label: string) {
  const acao = res.headers.get("access-control-allow-origin");
  // The function may either omit the header entirely or fall back to the
  // canonical allowed origin — but it must NEVER echo the forbidden one.
  expect(
    acao === forbidden,
    `${label}: ACAO must not echo forbidden origin "${forbidden}" (got "${acao}")`,
  ).toBe(false);

  // Wildcard would also be a problem for an authenticated/credentialed flow.
  // These functions intentionally don't use "*" — assert that too.
  if (acao === "*") {
    // If a function ever switches to wildcard ACAO, the call site must NOT
    // also be configured with credentials. The assertion below catches the
    // unsafe combination.
    const acac = res.headers.get("access-control-allow-credentials");
    expect(
      acac === "true",
      `${label}: wildcard ACAO with credentials=true is forbidden`,
    ).toBe(false);
  }
}

function expectNoCredentialLeak(res: Response, label: string) {
  const acac = res.headers.get("access-control-allow-credentials");
  // Either unset or "false" — never "true" for cross-origin attacker probes.
  if (acac !== null) {
    expect(acac.toLowerCase(), `${label}: credentials must not be allowed`).not.toBe("true");
  }
}

describe("Edge function CORS — disallowed origin regression", () => {
  for (const fn of FUNCTIONS) {
    describe(fn, () => {
      it("preflight from allowed origin echoes that origin (positive control)", async () => {
        const res = await preflight(fn, ALLOWED_ORIGIN);
        await res.text();
        const acao = res.headers.get("access-control-allow-origin");
        expect(acao).toBe(ALLOWED_ORIGIN);
      });

      for (const origin of FORBIDDEN_ORIGINS) {
        it(`preflight from forbidden origin "${origin}" does not echo it`, async () => {
          const res = await preflight(fn, origin);
          await res.text();
          expectNoOriginEcho(res, origin, `${fn} preflight ${origin}`);
          expectNoCredentialLeak(res, `${fn} preflight ${origin}`);
        });

        it(`POST from forbidden origin "${origin}" does not leak data cross-origin`, async () => {
          const res = await postCall(fn, origin, { ping: true });
          // Always drain to avoid Deno resource leaks.
          await res.text().catch(() => "");

          // Whether the function returns 2xx or 4xx, the critical invariant
          // is that ACAO is NOT the attacker's origin — so the browser would
          // refuse to expose any body to attacker-controlled JS.
          expectNoOriginEcho(res, origin, `${fn} POST ${origin}`);
          expectNoCredentialLeak(res, `${fn} POST ${origin}`);
        });
      }

      it("preflight without an Origin header still does not echo arbitrary origins", async () => {
        const res = await fetch(fnUrl(fn), {
          method: "OPTIONS",
          headers: {
            "Access-Control-Request-Method": "POST",
          },
        });
        await res.text();
        const acao = res.headers.get("access-control-allow-origin");
        // Falls back to canonical allowed origin — never wildcard, never undefined-echo.
        if (acao !== null) {
          expect(acao).not.toBe("");
          expect(acao).not.toBe("null");
          expect(acao).not.toBe("undefined");
        }
      });

      it("response always carries hardening security headers", async () => {
        const res = await preflight(fn, FORBIDDEN_ORIGINS[0]);
        await res.text();
        // These are independent of CORS — they must be present even on
        // attacker-origin preflights so the function never serves a
        // response that could be framed/sniffed.
        expect(res.headers.get("x-content-type-options")).toBe("nosniff");
        expect(res.headers.get("x-frame-options")).toBe("DENY");
        expect(res.headers.get("referrer-policy")).toBe(
          "strict-origin-when-cross-origin",
        );
      });
    });
  }
});
