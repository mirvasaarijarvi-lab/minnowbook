// CI guard: every auth-enforced edge function MUST short-circuit on a
// missing/malformed Authorization header — returning 401 within a tight
// budget, *before* doing any slow I/O (DB, Supabase auth round-trip,
// Stripe, mail, etc.).
//
// Previous outages were caused by functions that called `getClaims()`
// (or similar) without an early header check; on cold/slow paths this
// produced gateway-level 504s instead of clean 401s. The shared
// `requireAuth()` helper now enforces the fast-fail contract, and this
// test verifies that every auth-enforced handler still routes through
// it (or an equivalent early check).
//
// If you add a new auth-enforced edge function:
//   1. Export its handler from `index.ts` (e.g. `handleFooRequest`).
//   2. Append an entry to `AUTH_ENFORCED_HANDLERS` below.
//   3. Run this test locally with `deno test --allow-net --allow-env
//      --allow-read supabase/functions/_shared/auth-short-circuit.test.ts`.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withStubSupabaseEnv } from "./test-security-headers.ts";

import { handleAdminUsersRequest } from "../admin-users/index.ts";
import { handleArchiveReservationsRequest } from "../archive-reservations/index.ts";
import { handleCheckSubscriptionRequest } from "../check-subscription/index.ts";
import { handleCreateCheckoutRequest } from "../create-checkout/index.ts";
import { handleCustomerPortalRequest } from "../customer-portal/index.ts";
import { handleLogForbiddenAccessRequest } from "../log-forbidden-access/index.ts";
import { handleMfaRecoveryRequest } from "../mfa-recovery/index.ts";
import { handleMigrateBrandingAssetsRequest } from "../migrate-branding-assets/index.ts";
import { handleMintTenantPrivateUrlRequest } from "../mint-tenant-private-url/index.ts";
import { handleRedeemAccessCodeRequest } from "../redeem-access-code/index.ts";
import { handleSendOfferEmailRequest } from "../send-offer-email/index.ts";
import { handleSendReminderRequest } from "../send-reminder/index.ts";
import { handleSupportChatRequest } from "../support-chat/index.ts";

type Handler = (req: Request) => Promise<Response> | Response;

// Functions that MUST return 401 on a POST with no Authorization header,
// without doing any slow upstream work. Budget is intentionally tight
// (1500 ms) so any regression that re-introduces a pre-auth await on
// the network surface is caught here rather than at the gateway.
const AUTH_ENFORCED_HANDLERS: ReadonlyArray<{
  name: string;
  handler: Handler;
}> = [
  { name: "admin-users", handler: handleAdminUsersRequest },
  { name: "archive-reservations", handler: handleArchiveReservationsRequest },
  { name: "check-subscription", handler: handleCheckSubscriptionRequest },
  { name: "create-checkout", handler: handleCreateCheckoutRequest },
  { name: "customer-portal", handler: handleCustomerPortalRequest },
  { name: "log-forbidden-access", handler: handleLogForbiddenAccessRequest },
  { name: "mfa-recovery", handler: handleMfaRecoveryRequest },
  { name: "migrate-branding-assets", handler: handleMigrateBrandingAssetsRequest },
  { name: "mint-tenant-private-url", handler: handleMintTenantPrivateUrlRequest },
  { name: "redeem-access-code", handler: handleRedeemAccessCodeRequest },
  { name: "send-offer-email", handler: handleSendOfferEmailRequest },
  { name: "send-reminder", handler: handleSendReminderRequest },
  { name: "support-chat", handler: handleSupportChatRequest },
];

const SHORT_CIRCUIT_BUDGET_MS = 1_500;

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

function buildRequest(name: string, init: RequestInit): Request {
  return new Request(`https://example.test/${name}`, init);
}

async function assertShortCircuit401(
  name: string,
  handler: Handler,
  headers: Record<string, string>,
  scenario: string,
) {
  const started = performance.now();
  const res = await runWithBudget(
    `${name} (${scenario})`,
    SHORT_CIRCUIT_BUDGET_MS,
    async () => handler(
      buildRequest(name, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://mimmobook.com",
          ...headers,
        },
        body: JSON.stringify({}),
      }),
    ),
  );
  const elapsed = performance.now() - started;
  // Drain the body so Deno's resource tracker doesn't flag a leak.
  try { await res.text(); } catch { /* ignore */ }

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

for (const { name, handler } of AUTH_ENFORCED_HANDLERS) {
  Deno.test(
    `${name}: POST without Authorization returns 401 within ${SHORT_CIRCUIT_BUDGET_MS}ms`,
    withStubSupabaseEnv(async () => {
      await assertShortCircuit401(name, handler, {}, "missing header");
    }),
  );

  Deno.test(
    `${name}: POST with malformed Authorization (no Bearer) returns 401 within ${SHORT_CIRCUIT_BUDGET_MS}ms`,
    withStubSupabaseEnv(async () => {
      await assertShortCircuit401(
        name,
        handler,
        { Authorization: "Basic abc123" },
        "malformed header",
      );
    }),
  );
}
