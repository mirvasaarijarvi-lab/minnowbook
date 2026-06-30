// Shared assertion helper for the "fast JSON 401" contract that every
// auth-enforced edge function must honor when the request lacks (or
// malforms) an Authorization header.
//
// Four suites used to duplicate this logic with small drift between
// them — different budgets, different status checks, different ways of
// detecting "the body is HTML / a stack trace, not JSON":
//
//   - supabase/functions/_shared/auth-short-circuit.test.ts
//   - supabase/functions/_shared/auth-401-contract.test.ts
//   - supabase/functions/_shared/auth-401-no-env.test.ts
//   - supabase/functions/_shared/malformed-env-stub.test.ts
//
// Centralizing the assertion here guarantees:
//   - One canonical timing budget (DEFAULT_FAST_401_BUDGET_MS = 1500).
//   - One canonical "must be JSON" check (rejects HTML / stack traces).
//   - One canonical scenario-tagged failure message, so a regression
//     points at the exact handler + scenario that broke the contract.
//
// The helper is intentionally minimal: it does NOT check the JSON shape
// (that's auth-401-contract.test.ts's job), only that the handler
// returned 401 + parseable JSON within the budget. Suites that want
// shape assertions layer them on top of `assertFastJson401`.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/** Canonical fast-401 budget. The handler must build and return a 401
 *  Response within this window when auth is missing/malformed, with no
 *  network I/O, no `createClient(...)` construction that could throw,
 *  and no `auth.getUser()` round-trip. 1.5 s gives generous headroom
 *  over the observed ~5 to 50 ms hot path while still catching the
 *  regression mode where the handler accidentally proceeds to a Supabase
 *  call and hangs on a 5 s timeout. */
export const DEFAULT_FAST_401_BUDGET_MS = 1_500;

export type Handler = (req: Request) => Promise<Response> | Response;

export interface FastJson401Options {
  /** Override the timing budget (ms). Defaults to
   *  {@link DEFAULT_FAST_401_BUDGET_MS}. */
  budgetMs?: number;
  /** Free-form label included in every assertion message. Pair the
   *  handler name with the scenario being exercised, e.g.
   *  `"admin-users / missing Authorization"`. */
  label: string;
}

export interface FastJson401Result {
  /** Wall-clock duration of the handler invocation in milliseconds. */
  elapsedMs: number;
  /** Parsed JSON body. Guaranteed to be defined when this returns
   *  (assertion fails otherwise). */
  body: Record<string, unknown>;
  /** Raw text body, retained so callers can include it in custom
   *  follow-up assertions or error messages. */
  rawBody: string;
  /** The Response object, in case the caller wants to assert headers
   *  (e.g. `x-request-id`, CORS, security triad). */
  response: Response;
}

/** Build the canonical "no/malformed auth" probe Request. Handlers
 *  that need a shape-valid body (e.g. `mint-tenant-private-url` checks
 *  path shape before auth) can pass a custom `body`. */
export function buildUnauthenticatedProbe(
  handlerName: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request {
  const { method = "POST", body, headers = {} } = options;
  const payload =
    body === undefined
      ? "{}"
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  return new Request(`https://example.test/${handlerName}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
      ...headers,
    },
    body: method === "GET" || method === "HEAD" ? undefined : payload,
  });
}

/** Invoke `handler(req)` and assert the fast-JSON-401 contract:
 *
 *   1. Response status is exactly 401.
 *   2. Wall-clock time is below `budgetMs` (default 1500 ms).
 *   3. Body parses as JSON (rules out HTML 5xx pages, raw stack
 *      traces, and the "createClient threw before the auth branch"
 *      regression that surfaces as plaintext).
 *
 *  Returns the parsed body + raw text + Response so callers can layer
 *  additional shape/header assertions without re-invoking the handler. */
export async function assertFastJson401(
  handler: Handler,
  req: Request,
  options: FastJson401Options,
): Promise<FastJson401Result> {
  const { label, budgetMs = DEFAULT_FAST_401_BUDGET_MS } = options;

  const started = performance.now();
  const response = await handler(req);
  const elapsedMs = performance.now() - started;

  const rawBody = await response.text();

  assertEquals(
    response.status,
    401,
    `[${label}] expected 401, got ${response.status}. body=${rawBody.slice(0, 200)}`,
  );

  assert(
    elapsedMs < budgetMs,
    `[${label}] took ${elapsedMs.toFixed(0)}ms (budget ${budgetMs}ms). ` +
      `Handler likely proceeded to a Supabase call before checking auth.`,
  );

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `[${label}] 401 body is not JSON — suggests the handler threw ` +
        `before reaching its auth branch (createClient failure, ` +
        `unhandled exception, etc.). raw=${rawBody.slice(0, 200)}`,
    );
  }

  assert(
    body !== null && typeof body === "object" && !Array.isArray(body),
    `[${label}] 401 body must be a JSON object, got ${typeof body}: ${rawBody.slice(0, 200)}`,
  );

  return {
    elapsedMs,
    body: body as Record<string, unknown>,
    rawBody,
    response,
  };
}

/** Dynamic-import a handler from a sibling function directory. Common
 *  to every suite that iterates over the AUTH_ENFORCED list. */
export async function loadAuthHandler(
  name: string,
  exportName: string,
): Promise<Handler> {
  let mod: Record<string, unknown>;
  try {
    mod = await import(`../${name}/index.ts`);
  } catch (err) {
    // Re-throw with both handler dir and export name so a missing module
    // surfaces the same diagnostic shape as a missing export (the suite
    // greps the message for both tokens).
    throw new Error(
      `loadAuthHandler(${name}, ${exportName}): failed to import ../${name}/index.ts — ${(err as Error).message}`,
    );
  }
  const handler = mod[exportName] as Handler | undefined;
  assert(
    typeof handler === "function",
    `loadAuthHandler(${name}, ${exportName}): missing export ${exportName}`,
  );
  return handler;
}
