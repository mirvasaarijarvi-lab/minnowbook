// CI guard: every auth-enforced edge function MUST short-circuit on a
// missing/malformed Authorization header — returning 401 within a tight
// budget, *before* doing any slow I/O (DB, Supabase auth round-trip,
// Stripe, mail, etc.).
//
// Previous outages were caused by functions that called `getClaims()` /
// `getUser()` without an early header check; on cold/slow paths this
// produced gateway-level 504s instead of clean 401s. The shared
// `requireAuth()` helper now enforces the fast-fail contract, and this
// test verifies that every auth-enforced handler still routes through
// it (or an equivalent early check).
//
// If you add a new auth-enforced edge function:
//   1. Export its handler from `index.ts` (e.g. `handleFooRequest`).
//   2. Append an entry to `AUTH_ENFORCED` below.
//   3. Run this test locally with `deno test --allow-net --allow-env
//      --allow-read supabase/functions/_shared/auth-short-circuit.test.ts`.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withStubSupabaseEnv } from "./test-security-headers.ts";

// Many index.ts modules call `Deno.serve(handler)` at top level. Importing
// more than one in the same test process would collide on the default
// listen port. Stub Deno.serve to a no-op so handlers can be dynamically
// imported below without binding a socket. Static imports are hoisted
// before any code runs, so the handler modules must be loaded *after*
// this stub via dynamic `import()`.
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (..._args: unknown[]) =>
  ({ finished: Promise.resolve(), shutdown: () => Promise.resolve() }) as any;

type Handler = (req: Request) => Promise<Response> | Response;

// (function-name, exported handler symbol). Functions whose `npm:`
// specifiers don't resolve in every Deno sandbox (Stripe trio,
// cancel-account-deletion, export-user-data, request-account-deletion)
// are exercised via their own *_test.ts files; this guard covers the
// handlers that can be statically loaded without a node_modules dir.
const AUTH_ENFORCED: ReadonlyArray<{ name: string; exportName: string }> = [
  { name: "admin-users", exportName: "handleAdminUsersRequest" },
  { name: "archive-reservations", exportName: "handleArchiveReservationsRequest" },
  { name: "log-forbidden-access", exportName: "handleLogForbiddenAccessRequest" },
  { name: "mfa-recovery", exportName: "handleMfaRecoveryRequest" },
  { name: "migrate-branding-assets", exportName: "handleMigrateBrandingAssetsRequest" },
  { name: "mint-tenant-private-url", exportName: "handleMintTenantPrivateUrlRequest" },
  { name: "redeem-access-code", exportName: "handleRedeemAccessCodeRequest" },
  { name: "send-offer-email", exportName: "handleSendOfferEmailRequest" },
  { name: "send-reminder", exportName: "handleSendReminderRequest" },
  { name: "support-chat", exportName: "handleSupportChatRequest" },
];

const SHORT_CIRCUIT_BUDGET_MS = 1_500;

async function loadHandler(name: string, exportName: string): Promise<Handler> {
  const mod = await import(`../${name}/index.ts`);
  const handler = mod[exportName] as Handler | undefined;
  assert(
    typeof handler === "function",
    `${name}: expected export "${exportName}" to be a function`,
  );
  return handler;
}

async function runWithBudget<T>(
  label: string,
  budgetMs: number,
  task: () => Promise<T>,
): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: exceeded ${budgetMs}ms budget`)),
      budgetMs,
    );
  });
  try {
    return await Promise.race([task(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function assertShortCircuit401(
  name: string,
  handler: Handler,
  headers: Record<string, string>,
  scenario: string,
) {
  const req = new Request(`https://example.test/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
      ...headers,
    },
    body: JSON.stringify({}),
  });
  const started = performance.now();
  const res = await runWithBudget(
    `${name} (${scenario})`,
    SHORT_CIRCUIT_BUDGET_MS,
    async () => handler(req),
  );
  const elapsed = performance.now() - started;
  try { await res.text(); } catch { /* drain */ }

  assertEquals(
    res.status,
    401,
    `${name} (${scenario}): expected 401 short-circuit, got ${res.status} after ${elapsed.toFixed(0)}ms`,
  );
  assert(
    elapsed < SHORT_CIRCUIT_BUDGET_MS,
    `${name} (${scenario}): handler took ${elapsed.toFixed(0)}ms (>= ${SHORT_CIRCUIT_BUDGET_MS}ms budget)`,
  );
}

for (const { name, exportName } of AUTH_ENFORCED) {
  Deno.test(
    `${name}: POST without Authorization returns 401 within ${SHORT_CIRCUIT_BUDGET_MS}ms`,
    withStubSupabaseEnv(async () => {
      const handler = await loadHandler(name, exportName);
      await assertShortCircuit401(name, handler, {}, "missing header");
    }),
  );

  Deno.test(
    `${name}: POST with malformed Authorization (no Bearer) returns 401 within ${SHORT_CIRCUIT_BUDGET_MS}ms`,
    withStubSupabaseEnv(async () => {
      const handler = await loadHandler(name, exportName);
      await assertShortCircuit401(
        name,
        handler,
        { Authorization: "Basic abc123" },
        "malformed header",
      );
    }),
  );
}
