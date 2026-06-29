// CI guard (static): every auth-enforced edge function MUST route its
// auth check through `requireAuth(` / `verifyBearer(` from
// `_shared/require-auth.ts` (which wraps `getClaims()` in a hard
// timeout), OR perform an inline early-return on a missing/malformed
// Authorization header *before any await*.
//
// This complements `auth-short-circuit.test.ts` (which executes the
// handler) by also covering functions whose `npm:` import specifiers
// don't resolve in every Deno sandbox (Stripe trio,
// cancel-account-deletion, export-user-data, request-account-deletion).

import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const AUTH_ENFORCED_FUNCTIONS = [
  "admin-users",
  "archive-reservations",
  "cancel-account-deletion",
  "check-subscription",
  "create-checkout",
  "customer-portal",
  "export-user-data",
  "log-forbidden-access",
  "mfa-recovery",
  "migrate-branding-assets",
  "mint-tenant-private-url",
  "redeem-access-code",
  "request-account-deletion",
  "send-offer-email",
  "send-reminder",
  "support-chat",
] as const;

// Match either:
//   - `requireAuth(` / `verifyBearer(` from the shared helper, or
//   - an inline early-return guard on the Authorization header
//     (`.startsWith("Bearer ")` check followed by a `return new Response`
//     with status 401).
const HELPER_CALL = /\b(requireAuth|verifyBearer)\s*\(/;
const INLINE_GUARD = /authHeader[^;]*startsWith\(\s*["']Bearer\s/;

for (const fn of AUTH_ENFORCED_FUNCTIONS) {
  Deno.test(`${fn}: index.ts has an auth short-circuit check`, async () => {
    const path = new URL(`../${fn}/index.ts`, import.meta.url);
    const src = await Deno.readTextFile(path);
    const hasHelper = HELPER_CALL.test(src);
    const hasInline = INLINE_GUARD.test(src);
    assert(
      hasHelper || hasInline,
      `${fn}/index.ts does not call requireAuth()/verifyBearer() and has no inline ` +
        `Authorization header guard. Add one of:\n` +
        `  import { requireAuth } from "../_shared/require-auth.ts";\n` +
        `  const auth = await requireAuth(req, corsHeaders);\n` +
        `  if (auth instanceof Response) return auth;\n` +
        `…or an early-return Bearer check, *before* any await of slow I/O.`,
    );
  });
}
