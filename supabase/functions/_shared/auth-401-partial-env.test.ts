// Regression: when only SUPABASE_URL is configured but the keys
// (SERVICE_ROLE / ANON) are missing, empty, or whitespace, every
// auth-enforced handler MUST still short-circuit to a fast JSON 401 on
// missing Authorization — never throwing `supabaseKey is required.` and
// surfacing a 500.
//
// Complements `auth-401-no-env.test.ts` (all env unset) by covering the
// partial-config case that occurs in CI when one secret slot is populated
// but the others are masked to empty strings.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

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

const KEY_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "LOVABLE_API_KEY",
] as const;

const ALL_ENV = ["SUPABASE_URL", ...KEY_VARS] as const;

const BUDGET_MS = 1_500;
const STUB_URL = "https://stub.supabase.co";

type KeyState = "missing" | "empty" | "whitespace";

function applyKeyState(state: KeyState) {
  for (const k of KEY_VARS) {
    if (state === "missing") Deno.env.delete(k);
    else if (state === "empty") Deno.env.set(k, "");
    else Deno.env.set(k, "   \t\n");
  }
}

function withPartialEnv(state: KeyState, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const prev: Record<string, string | undefined> = {};
    for (const k of ALL_ENV) prev[k] = Deno.env.get(k);
    try {
      Deno.env.set("SUPABASE_URL", STUB_URL);
      applyKeyState(state);
      await fn();
    } finally {
      for (const k of ALL_ENV) {
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
      `${name} (${scenario}): 401 body is not JSON — handler likely threw before auth check. raw=${body.slice(0, 200)}`,
    );
  }
}

const STATES: ReadonlyArray<KeyState> = ["missing", "empty", "whitespace"];

for (const { name, exportName } of AUTH_ENFORCED) {
  for (const state of STATES) {
    Deno.test({
      name: `${name}: 401 short-circuit when SUPABASE_URL set but keys are ${state}`,
      sanitizeOps: false,
      sanitizeResources: false,
      fn: withPartialEnv(state, async () => {
        const handler = await loadHandler(name, exportName);
        await assertFast401(name, handler, `url-only / keys=${state}`);
      }),
    });
  }
}
