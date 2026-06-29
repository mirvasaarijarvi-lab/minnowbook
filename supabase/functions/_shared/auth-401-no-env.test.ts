// Regression: even when Supabase env vars are completely missing (or set
// to empty strings — the CI condition that originally caused
// `createClient(url, "")` to throw `supabaseKey is required.` and turn
// expected 401s into accidental 500s), every auth-enforced edge function
// MUST still short-circuit to a clean 401 when the request has no
// Authorization header.
//
// This is the inverse of `auth-401-contract.test.ts`: that suite stubs
// env so handlers can reach their auth branch; this suite intentionally
// does NOT stub, asserting that the auth check happens *before* any
// Supabase client construction.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Same Deno.serve stub as the other auth contract suites — see
// auth-short-circuit.test.ts for rationale.
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (..._args: unknown[]) =>
  ({ finished: Promise.resolve(), shutdown: () => Promise.resolve() }) as any;

type Handler = (req: Request) => Promise<Response> | Response;

// Handlers that construct their own admin client at request time and
// must short-circuit on missing auth before reaching createClient().
// `support-chat` is intentionally excluded (auth-optional public widget).
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

/** Snapshot then clear (or set to "") env, run fn, restore. */
function withMissingEnv(
  variant: "deleted" | "empty",
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const prev: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) prev[k] = Deno.env.get(k);
    try {
      for (const k of ENV_KEYS) {
        if (variant === "deleted") Deno.env.delete(k);
        else Deno.env.set(k, "");
      }
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

  // The body must be JSON (not an HTML 500 page or a thrown stack).
  try {
    JSON.parse(body);
  } catch {
    throw new Error(
      `${name} (${scenario}): 401 body is not JSON, suggesting the handler ` +
        `threw before reaching its auth branch. raw=${body.slice(0, 200)}`,
    );
  }
}

for (const { name, exportName } of AUTH_ENFORCED) {
  Deno.test({
    name: `${name}: missing Authorization returns 401 even with empty Supabase env`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: withMissingEnv("empty", async () => {
      const handler = await loadHandler(name, exportName);
      await assertFast401(name, handler, "empty env");
    }),
  });

  Deno.test({
    name: `${name}: missing Authorization returns 401 even with unset Supabase env`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: withMissingEnv("deleted", async () => {
      const handler = await loadHandler(name, exportName);
      await assertFast401(name, handler, "unset env");
    }),
  });
}
