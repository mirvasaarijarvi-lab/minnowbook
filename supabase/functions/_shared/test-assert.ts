// Shared, typed assertion helpers for Deno-based edge function tests.
//
// Goal: standardize how tests assert on the { res, json, text } shape
// produced by the per-test `callFn` / fetch wrappers, so that:
//
//   1. Status code + error body shape are checked together (and never
//      silently skipped when one half regresses).
//   2. Failure messages always include the response body, so a CI log
//      alone is enough to diagnose the regression.
//   3. The "missing SUPABASE_SERVICE_ROLE_KEY" path is a single,
//      named assertion across every test file instead of an ad-hoc
//      inline check that drifts.
//
// The helpers are intentionally framework-light: they take any object
// shaped like { res, json?, text } so each test file can keep its own
// fetch wrapper without conforming to a class hierarchy.
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Minimal response shape that every edge-function test wrapper in this
 * repo already produces. `json` is `unknown` because we never trust the
 * server to actually return JSON — `text` is the source of truth and
 * `json` is best-effort `JSON.parse(text)` from the caller.
 */
export interface FunctionResponse {
  res: Response;
  json: unknown;
  text: string;
}

export interface ErrorAssertion {
  /** Expected HTTP status. Required to prevent "any 4xx is fine" drift. */
  status: number;
  /**
   * Substring that must appear in the response's `error` field
   * (case-insensitive). Use this for the common case.
   */
  errorIncludes?: string;
  /**
   * Regex the response's `error` field must match. Prefer this when
   * `errorIncludes` is not specific enough (e.g. asserting a code or a
   * structured prefix like `Tier "<x>" allows`).
   */
  errorMatch?: RegExp;
  /**
   * Optional human label, prepended to assertion messages so a failing
   * CI log immediately identifies which scenario regressed.
   */
  label?: string;
}

function prefix(label?: string): string {
  return label ? `[${label}] ` : "";
}

/**
 * Render the response body for inclusion in assertion messages.
 * Truncated so a giant HTML error page doesn't blow up the CI log.
 */
function describeBody(result: FunctionResponse): string {
  const body = result.text ?? "";
  const truncated = body.length > 500 ? `${body.slice(0, 500)}…` : body;
  return `body=${truncated || "<empty>"}`;
}

/**
 * Read `error` from the parsed JSON body, returning `undefined` when
 * the body is not a JSON object or has no `error` field. Centralized so
 * every test file agrees on what counts as "the error message".
 */
function getErrorMessage(json: unknown): string | undefined {
  if (json && typeof json === "object" && "error" in json) {
    const v = (json as { error: unknown }).error;
    if (typeof v === "string") return v;
  }
  return undefined;
}

/**
 * Assert that an edge-function call returned an error response with the
 * expected status code AND a string `error` field in the body. When
 * `errorIncludes` / `errorMatch` are supplied, the message must also
 * match — guarding against the common regression where a function
 * starts returning the right status but with the wrong (or sanitized
 * away) error text.
 */
export function assertFunctionError(
  result: FunctionResponse,
  expected: ErrorAssertion,
): void {
  const p = prefix(expected.label);

  assertEquals(
    result.res.status,
    expected.status,
    `${p}expected HTTP ${expected.status}, got ${result.res.status}. ${
      describeBody(result)
    }`,
  );

  const message = getErrorMessage(result.json);
  assert(
    typeof message === "string" && message.length > 0,
    `${p}expected non-empty string \`error\` in JSON body. ${
      describeBody(result)
    }`,
  );

  if (expected.errorIncludes) {
    assert(
      message!.toLowerCase().includes(expected.errorIncludes.toLowerCase()),
      `${p}expected error to include "${expected.errorIncludes}", got "${message}"`,
    );
  }

  if (expected.errorMatch) {
    assert(
      expected.errorMatch.test(message!),
      `${p}expected error to match ${expected.errorMatch}, got "${message}"`,
    );
  }
}

/**
 * Assert that an edge-function call returned a success response.
 * Defaults to 200 because that's what every function in this repo
 * currently returns on success; pass `expectedStatus` for 201/204/etc.
 */
export function assertFunctionOk(
  result: FunctionResponse,
  expectedStatus = 200,
  label?: string,
): void {
  const p = prefix(label);
  assertEquals(
    result.res.status,
    expectedStatus,
    `${p}expected HTTP ${expectedStatus}, got ${result.res.status}. ${
      describeBody(result)
    }`,
  );
}

/**
 * Convenience wrapper for the "no SUPABASE_SERVICE_ROLE_KEY configured"
 * scenario. Every public edge function MUST short-circuit with a 400
 * (or other client-error) and a non-empty error body BEFORE attempting
 * any DB write — otherwise we'd leak partial state on misconfigured
 * deploys. This helper encodes that contract once so every test agrees.
 */
export function assertMissingServiceKeyResponse(
  result: FunctionResponse,
  label = "missing service key",
): void {
  assertFunctionError(result, {
    status: 400,
    label,
  });
}
