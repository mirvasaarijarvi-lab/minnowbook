/**
 * Regression: the live guest-link limit stays at 5 requests per minute.
 * The higher limit is only for the throwaway GitHub test backend.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { LIVE_RATE_LIMIT_MAX, resolveRateLimitMax } from "./index.ts";

const LIVE_URL = "https://lsgznskkxadplwnxplhd.supabase.co";
const env = (vars: Record<string, string | undefined>) => (n: string) => vars[n];

Deno.test("live limit constant is 5", () => {
  assertEquals(LIVE_RATE_LIMIT_MAX, 5);
});

Deno.test("live backend without override keeps 5", () => {
  assertEquals(resolveRateLimitMax(env({ SUPABASE_URL: LIVE_URL })), 5);
});

Deno.test("live backend ignores the test override", () => {
  for (const v of ["500", "1000", "6", "999999"]) {
    assertEquals(
      resolveRateLimitMax(env({ SUPABASE_URL: LIVE_URL, GUEST_PORTAL_TEST_RATE_LIMIT_MAX: v })),
      5,
      `override ${v} must not apply live`,
    );
  }
});

Deno.test("lookalike hosts do not count as local", () => {
  for (const url of [
    "https://localhost.evil.com",
    "https://kong.mimmobook.com",
    "https://127.0.0.1.nip.io",
    "not a url",
    "",
  ]) {
    assertEquals(
      resolveRateLimitMax(env({ SUPABASE_URL: url, GUEST_PORTAL_TEST_RATE_LIMIT_MAX: "500" })),
      5,
      url,
    );
  }
});

Deno.test("GitHub test backend uses its higher limit", () => {
  for (const url of ["http://kong:8000", "http://127.0.0.1:54321", "http://localhost:54321"]) {
    assertEquals(
      resolveRateLimitMax(env({ SUPABASE_URL: url, GUEST_PORTAL_TEST_RATE_LIMIT_MAX: "500" })),
      500,
      url,
    );
  }
});

Deno.test("test backend limit is capped and never lowered below 5", () => {
  const local = "http://kong:8000";
  assertEquals(resolveRateLimitMax(env({ SUPABASE_URL: local, GUEST_PORTAL_TEST_RATE_LIMIT_MAX: "50000" })), 1000);
  for (const v of ["0", "-1", "3", "5", "abc", "7.5"]) {
    assertEquals(resolveRateLimitMax(env({ SUPABASE_URL: local, GUEST_PORTAL_TEST_RATE_LIMIT_MAX: v })), 5, v);
  }
});

Deno.test("workflow sets the override only for the throwaway backend", async () => {
  const wf = await Deno.readTextFile(
    new URL("../../../.github/workflows/guest-link-local-backend.yml", import.meta.url),
  );
  assertEquals(/GUEST_PORTAL_TEST_RATE_LIMIT_MAX=500/.test(wf), true);
  assertEquals(/--env-file \/tmp\/portal-test\.env/.test(wf), true);
  assertEquals(/deploy/.test(wf), false, "the override workflow must never deploy");
});
