// Strict 401 contract test for every auth-enforced edge function.
//
// `auth-short-circuit.test.ts` already proves these handlers fail FAST
// (within 1.5 s) on missing/malformed Authorization. This file goes one
// step further and asserts the *response contract*:
//
//   - HTTP status is EXACTLY 401 (not 400, not 403, not 500).
//   - JSON body matches the canonical shape from `_shared/errors.ts`:
//       { error: string, code: string, message: string, status: 401 }
//     with `error === code` so legacy clients keep working.
//   - Content-Type is application/json.
//
// We exercise two scenarios per handler:
//   1. No Authorization header at all.
//   2. Authorization header present but not a Bearer token.
//
// Both must produce the same 401 contract — anything else is a client
// observability regression (the SDK / UI can no longer reliably tell
// "user is not signed in" from "request was malformed").

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withStubSupabaseEnv } from "./test-security-headers.ts";

// Same Deno.serve stub trick as auth-short-circuit.test.ts — see that file
// for rationale.
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (..._args: unknown[]) =>
  ({ finished: Promise.resolve(), shutdown: () => Promise.resolve() }) as any;

type Handler = (req: Request) => Promise<Response> | Response;

// Mirrors AUTH_ENFORCED in auth-short-circuit.test.ts. Keep in sync when
// adding a new auth-enforced function.
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

const BUDGET_MS = 1_500;

async function loadHandler(name: string, exportName: string): Promise<Handler> {
  const mod = await import(`../${name}/index.ts`);
  const handler = mod[exportName] as Handler | undefined;
  assert(
    typeof handler === "function",
    `${name}: expected export "${exportName}" to be a function`,
  );
  return handler;
}

async function runWithBudget<T>(label: string, task: () => Promise<T>): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: exceeded ${BUDGET_MS}ms budget`)),
      BUDGET_MS,
    );
  });
  try {
    return await Promise.race([task(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function assert401Contract(
  name: string,
  handler: Handler,
  headers: Record<string, string>,
  scenario: string,
): Promise<void> {
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
    async () => handler(req),
  );
  const elapsed = performance.now() - started;

  // Drain regardless of outcome — Deno will flag the response body as a leak
  // otherwise.
  const rawBody = await res.text();

  assertEquals(
    res.status,
    401,
    `${name} (${scenario}): expected HTTP 401, got ${res.status} (body=${rawBody.slice(0, 200)})`,
  );

  assert(
    elapsed < BUDGET_MS,
    `${name} (${scenario}): 401 took ${elapsed.toFixed(0)}ms (>= ${BUDGET_MS}ms budget) — handler is not short-circuiting`,
  );

  const ct = res.headers.get("Content-Type") ?? "";
  assert(
    ct.toLowerCase().includes("application/json"),
    `${name} (${scenario}): expected JSON Content-Type, got "${ct}"`,
  );

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch (err) {
    throw new Error(
      `${name} (${scenario}): 401 body is not valid JSON: ${(err as Error).message}; raw=${rawBody.slice(0, 200)}`,
    );
  }

  // Canonical error envelope from supabase/functions/_shared/errors.ts.
  assert(
    typeof body.code === "string" && (body.code as string).length > 0,
    `${name} (${scenario}): missing string "code" in 401 body (got ${JSON.stringify(body)})`,
  );
  assert(
    typeof body.error === "string" && (body.error as string).length > 0,
    `${name} (${scenario}): missing string "error" alias in 401 body`,
  );
  assertEquals(
    body.error,
    body.code,
    `${name} (${scenario}): "error" must alias "code" for legacy clients`,
  );
  assert(
    typeof body.message === "string" && (body.message as string).length > 0,
    `${name} (${scenario}): missing string "message" in 401 body`,
  );
  assertEquals(
    body.status,
    401,
    `${name} (${scenario}): "status" field must mirror HTTP 401`,
  );
}

for (const { name, exportName } of AUTH_ENFORCED) {
  Deno.test({
    name: `${name}: missing Authorization returns canonical 401`,
    // Supabase JS client schedules a token-refresh interval on construction;
    // disable the sanitizer for the same reason as auth-short-circuit.test.ts.
    sanitizeOps: false,
    sanitizeResources: false,
    fn: withStubSupabaseEnv(async () => {
      const handler = await loadHandler(name, exportName);
      await assert401Contract(name, handler, {}, "missing header");
    }),
  });

  Deno.test({
    name: `${name}: malformed Authorization (non-Bearer) returns canonical 401`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: withStubSupabaseEnv(async () => {
      const handler = await loadHandler(name, exportName);
      await assert401Contract(
        name,
        handler,
        { Authorization: "Basic abc123" },
        "malformed header",
      );
    }),
  });

  Deno.test({
    name: `${name}: Bearer with empty token returns canonical 401`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: withStubSupabaseEnv(async () => {
      const handler = await loadHandler(name, exportName);
      await assert401Contract(
        name,
        handler,
        { Authorization: "Bearer    " },
        "empty bearer",
      );
    }),
  });
}
