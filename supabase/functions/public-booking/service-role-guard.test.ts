// Unit tests for the `assertServiceRoleKey` guard exported by
// `public-booking/index.ts`. The guard runs at the very top of the
// request handler, before `createClient` and before any DB write, and
// is the function's single source of truth for "what happens when
// SUPABASE_SERVICE_ROLE_KEY is missing in production".
//
// These tests pin the contract the dashboard / public booking UI
// depends on:
//   * status MUST be 400 (NOT 500), so the SPA renders an actionable
//     misconfig message instead of a generic "system error";
//   * body MUST include the machine-readable `error_code:
//     "SERVICE_ROLE_KEY_MISSING"` so the SPA can route to a precise
//     copy string;
//   * the guard MUST treat empty / whitespace-only env values the
//     same as a fully missing var (production has been bitten by
//     `SUPABASE_SERVICE_ROLE_KEY=""` deploys before).
//
// We don't spin up Deno.serve or hit the network: the guard is a pure
// function, and that's the entire point of the refactor: every branch
// is unit-testable without an integration harness.
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertServiceRoleKey } from "./index.ts";

Deno.test("assertServiceRoleKey: returns ok=true with trimmed key when present", () => {
  const result = assertServiceRoleKey("  real-service-role-key  ");
  assert(result.ok, "expected ok=true for non-empty key");
  if (result.ok) {
    assertEquals(
      result.serviceRoleKey,
      "real-service-role-key",
      "key must be trimmed before use",
    );
  }
});

Deno.test("assertServiceRoleKey: rejects undefined env value with 400 + error_code", async () => {
  const result = assertServiceRoleKey(undefined);
  assert(!result.ok, "expected ok=false when env var is undefined");
  if (result.ok) return; // type narrowing
  assertEquals(result.response.status, 400);
  const body = await result.response.json();
  assertEquals(body.error_code, "SERVICE_ROLE_KEY_MISSING");
  assert(
    typeof body.error === "string" && body.error.length > 0,
    "expected non-empty human-readable `error` string",
  );
});

Deno.test("assertServiceRoleKey: rejects empty string with 400", async () => {
  const result = assertServiceRoleKey("");
  assert(!result.ok);
  if (result.ok) return;
  assertEquals(result.response.status, 400);
  const body = await result.response.json();
  assertEquals(body.error_code, "SERVICE_ROLE_KEY_MISSING");
});

Deno.test("assertServiceRoleKey: rejects whitespace-only value with 400", async () => {
  // Production guard against `SUPABASE_SERVICE_ROLE_KEY="   "` style
  // misconfigurations, which would otherwise pass a truthy-but-useless
  // value into createClient and cause downstream RLS failures.
  const result = assertServiceRoleKey("   \t  \n");
  assert(!result.ok);
  if (result.ok) return;
  assertEquals(result.response.status, 400);
  const body = await result.response.json();
  assertEquals(body.error_code, "SERVICE_ROLE_KEY_MISSING");
});

Deno.test("assertServiceRoleKey: missing-key response carries CORS + JSON headers so the browser can read the body", async () => {
  // Without the right CORS headers the SPA would see a generic
  // "Failed to fetch" and lose the precise `error_code`. Pin the
  // contract so future header refactors don't silently regress it.
  const result = assertServiceRoleKey(undefined);
  assert(!result.ok);
  if (result.ok) return;
  assertEquals(
    result.response.headers.get("content-type"),
    "application/json",
  );
  assertEquals(
    result.response.headers.get("access-control-allow-origin"),
    "*",
  );
  // Drain the body so Deno's resource sanitizer stays clean.
  await result.response.text();
});
