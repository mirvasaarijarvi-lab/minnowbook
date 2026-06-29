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

// (function-name, exported handler symbol, probe body). The probe body
// has to satisfy any *non-auth* shape validation that legitimately runs
// before the auth check (e.g. mint-tenant-private-url validates the path
// shape first so the e2e malicious-paths gate can run anonymously). For
// handlers that check auth first, an empty `{}` is fine.
//
// `support-chat` is intentionally NOT in this list: it's auth-optional
// (the chat widget renders on public marketing pages), and gating it
// behind a 401 would break those flows. That contract is covered by
// `support-chat`'s own tests.
const AUTH_ENFORCED: ReadonlyArray<{
  name: string;
  exportName: string;
  probeBody?: unknown;
}> = [
  { name: "admin-users", exportName: "handleAdminUsersRequest" },
  { name: "archive-reservations", exportName: "handleArchiveReservationsRequest" },
  { name: "log-forbidden-access", exportName: "handleLogForbiddenAccessRequest" },
  { name: "mfa-recovery", exportName: "handleMfaRecoveryRequest" },
  { name: "migrate-branding-assets", exportName: "handleMigrateBrandingAssetsRequest" },
  {
    name: "mint-tenant-private-url",
    exportName: "handleMintTenantPrivateUrlRequest",
    // Shape-valid path so we exercise the auth branch, not the path validator.
    probeBody: { path: "tenants/00000000-0000-0000-0000-000000000000/sample.jpg" },
  },
  { name: "redeem-access-code", exportName: "handleRedeemAccessCodeRequest" },
  { name: "send-offer-email", exportName: "handleSendOfferEmailRequest" },
  { name: "send-reminder", exportName: "handleSendReminderRequest" },
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

  // Body must be parseable JSON, but we don't lock the exact field shape
  // here — `errors_test.ts` covers the canonical envelope. This test's job
  // is to guarantee the *status code and latency* contract.
  try {
    JSON.parse(rawBody);
  } catch (err) {
    throw new Error(
      `${name} (${scenario}): 401 body is not valid JSON: ${(err as Error).message}; raw=${rawBody.slice(0, 200)}`,
    );
  }
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
