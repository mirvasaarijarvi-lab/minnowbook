// Regression: GitHub Actions (and other CI runners) propagate masked
// or withheld secrets to child processes as *empty strings* rather
// than unsetting them. Historically that turned `Deno.env.get(...)!`
// + `createClient(url, "")` into a thrown `supabaseKey is required.`
// — surfaced to the caller as a 500 instead of the expected 401.
//
// Two-layer guarantee asserted here:
//
//  1. `coerceMissingEnv` collapses every "looks unset"
//     representation (`undefined`, `""`, whitespace-only) to
//     `undefined`, and `withStubSupabaseEnv` actually substitutes a
//     usable stub when the inherited value is one of those.
//
//  2. With the parent env pre-seeded to empty strings (the exact CI
//     condition), every auth-enforced handler still returns a clean
//     JSON 401 — never a 500 — for an unauthenticated request.
//
// This complements `auth-401-no-env.test.ts` (which clears env per
// handler) by asserting the inherited-empty case as a single,
// explicit regression and by pinning the helper contract that makes
// the short-circuit possible.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  coerceMissingEnv,
  withStubSupabaseEnv,
} from "./test-security-headers.ts";

// deno-lint-ignore no-explicit-any
(Deno as any).serve = (..._args: unknown[]) =>
  ({ finished: Promise.resolve(), shutdown: () => Promise.resolve() }) as any;

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "LOVABLE_API_KEY",
] as const;

const AUTH_ENFORCED: ReadonlyArray<{ name: string; exportName: string }> = [
  { name: "admin-users", exportName: "handleAdminUsersRequest" },
  { name: "archive-reservations", exportName: "handleArchiveReservationsRequest" },
  { name: "mfa-recovery", exportName: "handleMfaRecoveryRequest" },
  { name: "migrate-branding-assets", exportName: "handleMigrateBrandingAssetsRequest" },
  { name: "redeem-access-code", exportName: "handleRedeemAccessCodeRequest" },
  { name: "send-offer-email", exportName: "handleSendOfferEmailRequest" },
  { name: "send-reminder", exportName: "handleSendReminderRequest" },
];

const BUDGET_MS = 1_500;

/** Snapshot env, set each key to the same inherited empty payload
 *  (mirroring the CI runner's masked-secret behavior), run fn,
 *  restore. */
function withInheritedEmptyEnv(
  payload: "" | " " | "\t\n",
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const prev: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) prev[k] = Deno.env.get(k);
    try {
      for (const k of ENV_KEYS) Deno.env.set(k, payload);
      await fn();
    } finally {
      for (const k of ENV_KEYS) {
        if (typeof prev[k] === "string") Deno.env.set(k, prev[k]!);
        else Deno.env.delete(k);
      }
    }
  };
}

// ---------------------------------------------------------------
// Layer 1: helper contract
// ---------------------------------------------------------------

Deno.test("coerceMissingEnv: inherited empty strings are missing", () => {
  assertEquals(coerceMissingEnv(undefined), undefined);
  assertEquals(coerceMissingEnv(""), undefined);
  assertEquals(coerceMissingEnv(" "), undefined);
  assertEquals(coerceMissingEnv("\t\n  "), undefined);
});

Deno.test("coerceMissingEnv: non-empty values pass through verbatim", () => {
  assertEquals(coerceMissingEnv("x"), "x");
  // Real tokens with edge whitespace must NOT be trimmed.
  assertEquals(coerceMissingEnv(" token "), " token ");
});

Deno.test({
  name: "withStubSupabaseEnv: replaces inherited empty env with usable stubs",
  fn: withInheritedEmptyEnv("", async () => {
    let observed: Record<string, string | undefined> = {};
    await withStubSupabaseEnv(async () => {
      for (const k of ENV_KEYS) observed[k] = Deno.env.get(k);
    })();
    for (const k of ENV_KEYS) {
      const v = observed[k];
      assert(
        typeof v === "string" && v.length > 0,
        `${k} was not stubbed (got ${JSON.stringify(v)}); ` +
          `inherited empty string leaked through.`,
      );
    }
  }),
});

Deno.test({
  name: "withStubSupabaseEnv: restores inherited empty values after fn",
  fn: withInheritedEmptyEnv("", async () => {
    await withStubSupabaseEnv(async () => {
      // no-op
    })();
    for (const k of ENV_KEYS) {
      assertEquals(
        Deno.env.get(k),
        "",
        `${k} should have been restored to the inherited empty string`,
      );
    }
  }),
});

// ---------------------------------------------------------------
// Layer 2: handlers never 500 under inherited-empty env
// ---------------------------------------------------------------

async function assertJsonFast401(name: string, exportName: string) {
  const mod = await import(`../${name}/index.ts`);
  const handler = mod[exportName] as (req: Request) => Promise<Response> | Response;
  assert(typeof handler === "function", `${name}: missing export ${exportName}`);

  const req = new Request(`https://example.test/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://mimmobook.com" },
    body: "{}",
  });

  const started = performance.now();
  const res = await handler(req);
  const elapsed = performance.now() - started;
  const body = await res.text();

  assert(
    res.status !== 500,
    `${name}: returned 500 under inherited empty env — auth check did ` +
      `not run before Supabase client construction. body=${body.slice(0, 200)}`,
  );
  assertEquals(
    res.status,
    401,
    `${name}: expected 401, got ${res.status}; body=${body.slice(0, 200)}`,
  );
  assert(
    elapsed < BUDGET_MS,
    `${name}: took ${elapsed.toFixed(0)}ms (>${BUDGET_MS}ms budget)`,
  );
  try {
    JSON.parse(body);
  } catch {
    throw new Error(
      `${name}: 401 body is not JSON (raw=${body.slice(0, 200)}); ` +
        `handler likely threw before the auth branch.`,
    );
  }
}

for (const { name, exportName } of AUTH_ENFORCED) {
  Deno.test({
    name: `${name}: inherited empty Supabase env still yields a JSON 401 (not 500)`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: withInheritedEmptyEnv("", async () => {
      await assertJsonFast401(name, exportName);
    }),
  });

  Deno.test({
    name: `${name}: inherited whitespace-only Supabase env still yields a JSON 401 (not 500)`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: withInheritedEmptyEnv("\t\n", async () => {
      await assertJsonFast401(name, exportName);
    }),
  });
}
