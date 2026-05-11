/**
 * Edge Function — disallowed Origin returns explicit 4xx
 *
 * The companion test `edge-function-cors-origin.test.ts` already verifies
 * that a disallowed Origin is never echoed back in `Access-Control-Allow-Origin`
 * (so a browser would refuse to expose any response body cross-origin).
 *
 * This file adds the *server-side* invariant: when a request arrives with
 * an Origin header that is NOT on the allowlist, the function must return
 * an explicit 4xx (specifically 403) status BEFORE running any auth or
 * business logic, and the response body must be a generic Forbidden message
 * with no sensitive details (no stack traces, no schema names, no allowlist
 * contents, no JWT/email/UUID echoes, no internal route info).
 *
 * Tested functions: admin-users, support-chat — both implement the
 * isOriginAllowed() gate.
 *
 * Notes:
 *   - OPTIONS preflights remain permissive (browser-side CORS handles those).
 *   - A *missing* Origin header is treated as a non-browser caller (curl,
 *     server-to-server) and is NOT 403'd — only an explicit, disallowed
 *     Origin triggers the gate.
 */
import "@/test/setup";
import { describe, it, expect } from "vitest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const FUNCTIONS = ["admin-users", "support-chat"] as const;

const DISALLOWED_ORIGINS = [
  "https://evil.example.com",
  "https://attacker.test",
  "http://localhost.evil.com",
  "https://lovable.app.attacker.com", // suffix-injection
  "https://notlovable.app", // host-confusion
  "https://lovable.app", // bare apex, not a *.lovable.app subdomain
  "http://minnowbook.lovable.app", // wrong scheme
  "null", // sandboxed iframe / file://
];

const ALLOWED_ORIGIN = "https://minnowbook.lovable.app";

// Patterns that, if present in a body, would indicate sensitive leakage.
const FORBIDDEN_BODY_SUBSTRINGS: Array<{ label: string; re: RegExp }> = [
  { label: "stack trace 'at '", re: /\bat\s+[A-Za-z_$][\w$]*\s*\(/ },
  { label: "file path", re: /\/(?:home|var|usr|root|deno|src)\// },
  { label: "supabase URL", re: /https:\/\/[a-z0-9-]+\.supabase\.co/i },
  { label: "service role hint", re: /service[_-]?role/i },
  { label: "JWT", re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { label: "PostgreSQL error code", re: /\b(?:PGRST|22\d{3}|23\d{3}|42\d{3})\b/ },
  { label: "table/column hint", re: /\b(?:tenant_users|auth\.users|pg_)\b/i },
  { label: "allowlist echo", re: /lovable\.app/i }, // body must NOT mention allowlist
  { label: "email address", re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
];

function fnUrl(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function postFromOrigin(name: string, origin: string, body: unknown) {
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

function expectBodyHasNoSensitiveLeakage(text: string, label: string) {
  for (const { label: name, re } of FORBIDDEN_BODY_SUBSTRINGS) {
    expect(
      re.test(text),
      `${label}: response body must not contain ${name} — got: ${text.slice(0, 200)}`,
    ).toBe(false);
  }
}

function expectBodyIsGeneric(text: string, label: string) {
  // The body should be a small JSON envelope. A blanket size check catches
  // cases where the function accidentally returns a stack trace or HTML page.
  expect(text.length, `${label}: body must be small/generic`).toBeLessThan(200);

  // Must be parseable JSON with a generic 'error' string.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label}: body is not JSON — got: ${text.slice(0, 200)}`);
  }
  expect(typeof parsed).toBe("object");
  expect(parsed).not.toBeNull();
  const err = (parsed as { error?: unknown }).error;
  expect(typeof err, `${label}: 'error' field must be a string`).toBe("string");
  // Must be a short, opaque message — "Forbidden" is the canonical value.
  expect((err as string).length).toBeLessThan(64);
}

// Each `it` in this suite makes a live HTTPS round-trip to the deployed
// edge function. The default 5s Vitest timeout is too tight for cold-start
// edge runtimes (admin-users in particular can take >5s on first hit in CI).
// Bump per-test timeout to 30s for the whole describe block.
describe("Edge functions — disallowed Origin returns explicit 403", { timeout: 30_000 }, () => {
  for (const fn of FUNCTIONS) {
    describe(fn, () => {
      it("allowed origin is NOT 403'd by the origin gate (positive control)", async () => {
        const res = await postFromOrigin(fn, ALLOWED_ORIGIN, { ping: true });
        const text = await res.text().catch(() => "");
        // We do NOT expect 200 here — without a real session/body the
        // function will fail auth/validation. The point is simply that the
        // response is NOT the origin-gate's 403.
        // If it IS 403, the body must not be the generic origin-gate one.
        if (res.status === 403) {
          // Permissible if the auth layer itself returns 403, but it must
          // NOT be the origin gate's exact "Forbidden" payload triggered
          // before auth runs.
          expect(text).not.toBe(JSON.stringify({ error: "Forbidden" }));
        }
      });

      for (const origin of DISALLOWED_ORIGINS) {
        it(`returns 403 for disallowed origin "${origin}"`, async () => {
          const res = await postFromOrigin(fn, origin, { action: "list" });
          const text = await res.text().catch(() => "");

          expect(
            res.status,
            `${fn} from ${origin}: expected 403, got ${res.status} (body: ${text.slice(0, 200)})`,
          ).toBe(403);

          expectBodyIsGeneric(text, `${fn} ${origin}`);
          expectBodyHasNoSensitiveLeakage(text, `${fn} ${origin}`);
        });

        it(`403 from "${origin}" includes hardening security headers`, async () => {
          const res = await postFromOrigin(fn, origin, { action: "list" });
          await res.text().catch(() => "");
          expect(res.headers.get("x-content-type-options")).toBe("nosniff");
          expect(res.headers.get("x-frame-options")).toBe("DENY");
          expect(res.headers.get("referrer-policy")).toBe(
            "strict-origin-when-cross-origin",
          );
        });

        it(`403 from "${origin}" never echoes the forbidden origin in ACAO`, async () => {
          const res = await postFromOrigin(fn, origin, { action: "list" });
          await res.text().catch(() => "");
          const acao = res.headers.get("access-control-allow-origin");
          expect(acao).not.toBe(origin);
          expect(acao).not.toBe("*");
        });
      }

      it("403 response is consistent across repeated probes (no oracle)", async () => {
        const probes = await Promise.all(
          Array.from({ length: 5 }, () =>
            postFromOrigin(fn, "https://evil.example.com", { action: "list" }),
          ),
        );
        const bodies = await Promise.all(probes.map((r) => r.text()));
        const statuses = probes.map((r) => r.status);

        // Every probe must be 403.
        for (const s of statuses) expect(s).toBe(403);

        // All bodies must be identical — if they varied, an attacker could
        // probe internal state via response differences.
        expect(new Set(bodies).size).toBe(1);
      });

      it("does NOT 403 a request that omits the Origin header (server-to-server)", async () => {
        // No Origin header at all — represents curl/server callers, which
        // are NOT browser-CORS-bound and must reach the auth layer instead
        // of being blanket-blocked.
        const res = await fetch(fnUrl(fn), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: "list" }),
        });
        const text = await res.text().catch(() => "");

        // It may legitimately return 401/400/etc from auth/validation — but
        // it must NOT be the origin-gate 403 with the generic body.
        if (res.status === 403) {
          expect(text).not.toBe(JSON.stringify({ error: "Forbidden" }));
        }
      });
    });
  }
});
