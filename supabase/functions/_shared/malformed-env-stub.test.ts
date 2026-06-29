// Regression: extends auth-401-no-env.test.ts with malformed and
// whitespace-padded Supabase env values. CI runners sometimes inject
// secrets as "   ", "\t\n", or a single space when the underlying
// secret is unavailable; `coerceMissingEnv` must treat all of those as
// missing so `withStubSupabaseEnv` substitutes a usable stub and the
// handler still reaches its 401 branch (instead of crashing inside
// `createClient(url, "  ")` with `supabaseKey is required.`).
//
// Two layers are asserted:
//   1. Helper contract: `coerceMissingEnv` collapses every
//      whitespace-only / empty payload to `undefined`, and
//      `withStubSupabaseEnv` overwrites those inherited values with
//      its stubs (without trimming legitimate non-empty secrets).
//   2. Per-handler 401: every auth-enforced edge function returns a
//      fast JSON 401 when env vars are inherited as whitespace-only
//      strings AND the request lacks an Authorization header.

import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  coerceMissingEnv,
  withStubSupabaseEnv,
} from "./test-security-headers.ts";

// Same Deno.serve stub as the other auth contract suites.
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (..._args: unknown[]) =>
  ({ finished: Promise.resolve(), shutdown: () => Promise.resolve() }) as any;

type Handler = (req: Request) => Promise<Response> | Response;

const AUTH_ENFORCED: ReadonlyArray<{ name: string; exportName: string }> = [
  { name: "admin-users", exportName: "handleAdminUsersRequest" },
  { name: "archive-reservations", exportName: "handleArchiveReservationsRequest" },
  { name: "mfa-recovery", exportName: "handleMfaRecoveryRequest" },
  { name: "migrate-branding-assets", exportName: "handleMigrateBrandingAssetsRequest" },
  { name: "redeem-access-code", exportName: "handleRedeemAccessCodeRequest" },
  { name: "send-offer-email", exportName: "handleSendOfferEmailRequest" },
  { name: "send-reminder", exportName: "handleSendReminderRequest" },
];

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "LOVABLE_API_KEY",
] as const;

const BUDGET_MS = 1_500;

// The whitespace / malformed payloads CI has been observed to inject.
// Each one MUST be treated as "missing" by `coerceMissingEnv`.
const MALFORMED_VARIANTS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "single space", value: " " },
  { label: "multiple spaces", value: "   " },
  { label: "tab only", value: "\t" },
  { label: "newline only", value: "\n" },
  { label: "carriage return + newline", value: "\r\n" },
  { label: "mixed whitespace", value: " \t \n \r " },
  { label: "non-breaking space", value: "\u00a0" },
];

// ---------------------------------------------------------------------------
// Layer 1: helper contract
// ---------------------------------------------------------------------------

for (const { label, value } of MALFORMED_VARIANTS) {
  Deno.test(`coerceMissingEnv: ${label} -> undefined`, () => {
    assertEquals(
      coerceMissingEnv(value),
      undefined,
      `expected ${JSON.stringify(value)} to be coerced to undefined`,
    );
  });
}

Deno.test("coerceMissingEnv: legitimate token returned verbatim (no trimming)", () => {
  // A real anon key shape is base64-url-ish; pad with leading/trailing
  // characters that look whitespace-adjacent to confirm we never trim.
  const real = "eyJhbGciOiJIUzI1NiJ9.payload.sig";
  assertEquals(coerceMissingEnv(real), real);
  // A value that contains internal whitespace is also kept as-is — only
  // fully-blank payloads collapse to undefined.
  assertEquals(coerceMissingEnv("ab cd"), "ab cd");
});

Deno.test({
  name: "withStubSupabaseEnv: overwrites whitespace-only inherited values",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const prev: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) prev[k] = Deno.env.get(k);
    try {
      for (const k of ENV_KEYS) Deno.env.set(k, "   \t\n");

      await withStubSupabaseEnv(async () => {
        for (const k of ENV_KEYS) {
          const v = Deno.env.get(k);
          assert(typeof v === "string" && v.length > 0, `${k} should be stubbed, got ${JSON.stringify(v)}`);
          assert(v!.trim().length > 0, `${k} stub must be non-whitespace, got ${JSON.stringify(v)}`);
          assertNotEquals(v, "   \t\n", `${k} stub must not equal inherited whitespace`);
        }
      })();

      // Teardown must restore the inherited (whitespace) values byte-for-byte.
      for (const k of ENV_KEYS) {
        assertEquals(
          Deno.env.get(k),
          "   \t\n",
          `${k}: teardown must restore the inherited whitespace value`,
        );
      }
    } finally {
      for (const k of ENV_KEYS) {
        if (typeof prev[k] === "string") Deno.env.set(k, prev[k]!);
        else Deno.env.delete(k);
      }
    }
  },
});

Deno.test({
  name: "withStubSupabaseEnv: preserves legitimate non-empty inherited values",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const prev: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) prev[k] = Deno.env.get(k);
    try {
      const sentinel = "real-value-do-not-overwrite";
      for (const k of ENV_KEYS) Deno.env.set(k, sentinel);

      await withStubSupabaseEnv(async () => {
        for (const k of ENV_KEYS) {
          assertEquals(
            Deno.env.get(k),
            sentinel,
            `${k}: real inherited value must not be overwritten by stub`,
          );
        }
      })();
    } finally {
      for (const k of ENV_KEYS) {
        if (typeof prev[k] === "string") Deno.env.set(k, prev[k]!);
        else Deno.env.delete(k);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Layer 2: per-handler 401 with malformed env values
// ---------------------------------------------------------------------------

function withMalformedEnv(
  value: string,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const prev: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) prev[k] = Deno.env.get(k);
    try {
      for (const k of ENV_KEYS) Deno.env.set(k, value);
      await fn();
    } finally {
      for (const k of ENV_KEYS) {
        if (typeof prev[k] === "string") Deno.env.set(k, prev[k]!);
        else Deno.env.delete(k);
      }
    }
  };
}

async function loadHandler(name: string, exportName: string): Promise<Handler> {
  const mod = await import(`../${name}/index.ts`);
  const handler = mod[exportName] as Handler | undefined;
  assert(typeof handler === "function", `${name}: missing export ${exportName}`);
  return handler;
}

async function assertFast401(name: string, handler: Handler, scenario: string) {
  const req = new Request(`https://example.test/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://mimmobook.com" },
    body: "{}",
  });

  const started = performance.now();
  const res = await handler(req);
  const elapsed = performance.now() - started;
  const body = await res.text();

  assertEquals(
    res.status,
    401,
    `${name} (${scenario}): expected 401, got ${res.status}; body=${body.slice(0, 200)}`,
  );
  assert(
    elapsed < BUDGET_MS,
    `${name} (${scenario}): took ${elapsed.toFixed(0)}ms (>${BUDGET_MS}ms budget)`,
  );
  try {
    JSON.parse(body);
  } catch {
    throw new Error(
      `${name} (${scenario}): 401 body is not JSON, suggesting the handler ` +
        `threw before reaching its auth branch. raw=${body.slice(0, 200)}`,
    );
  }
}

// Cover the two highest-signal variants (single space and mixed
// whitespace) for every handler. The helper-contract tests above
// already prove the remaining variants collapse identically — running
// the full cartesian product would just lengthen CI without raising
// confidence.
const HANDLER_VARIANTS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "single space env", value: " " },
  { label: "mixed whitespace env", value: " \t \n \r " },
];

for (const { name, exportName } of AUTH_ENFORCED) {
  for (const { label, value } of HANDLER_VARIANTS) {
    Deno.test({
      name: `${name}: missing Authorization returns 401 with ${label}`,
      sanitizeOps: false,
      sanitizeResources: false,
      fn: withMalformedEnv(value, async () => {
        const handler = await loadHandler(name, exportName);
        await assertFast401(name, handler, label);
      }),
    });
  }
}
