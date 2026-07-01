// Unit tests for the shared Supabase env stubbing helper. Pins the
// contract that callers across mfa-recovery (and anywhere else) depend on:
//
//   - undefined  -> fallback
//   - ""         -> fallback        (the CI GitHub Actions pitfall)
//   - "   "      -> fallback        (whitespace counts as missing)
//   - "real"     -> kept as-is
//
// If any of these regress, the auth-timeout suite silently 500s instead
// of exercising the auth.getUser() race.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __DEFAULT_STUBS_FOR_TEST,
  coalesceEnv,
  restoreSupabaseEnv,
  stubSupabaseEnv,
  stubSupabaseEnvVar,
} from "./stub-supabase-env.ts";


Deno.test("coalesceEnv: undefined -> fallback", () => {
  assertEquals(coalesceEnv(undefined, "fb"), "fb");
});

Deno.test("coalesceEnv: null -> fallback", () => {
  assertEquals(coalesceEnv(null, "fb"), "fb");
});

Deno.test("coalesceEnv: empty string (the CI pitfall) -> fallback", () => {
  // This is the case that broke auth-timeout.test.ts when it used `??`.
  assertEquals(coalesceEnv("", "fb"), "fb");
});

Deno.test("coalesceEnv: whitespace-only -> fallback", () => {
  assertEquals(coalesceEnv("   ", "fb"), "fb");
  assertEquals(coalesceEnv("\t\n", "fb"), "fb");
});

Deno.test("coalesceEnv: real value preserved verbatim", () => {
  assertEquals(coalesceEnv("http://real.supabase.co", "fb"), "http://real.supabase.co");
});

Deno.test("coalesceEnv: real value with surrounding text is NOT trimmed", () => {
  // We only treat all-whitespace as missing; padded real values stay padded
  // because the upstream may legitimately need them (rare, but explicit).
  assertEquals(coalesceEnv(" real ", "fb"), " real ");
});

Deno.test({
  name: "stubSupabaseEnvVar: writes fallback when env is empty string",
  fn: () => {
    Deno.env.set("__TEST_STUB_VAR__", "");
    const result = stubSupabaseEnvVar("__TEST_STUB_VAR__", "fallback-x");
    assertEquals(result, "fallback-x");
    assertEquals(Deno.env.get("__TEST_STUB_VAR__"), "fallback-x");
    Deno.env.delete("__TEST_STUB_VAR__");
  },
});

Deno.test({
  name: "stubSupabaseEnvVar: keeps existing real value untouched",
  fn: () => {
    Deno.env.set("__TEST_STUB_VAR__", "already-set");
    const result = stubSupabaseEnvVar("__TEST_STUB_VAR__", "fallback-x");
    assertEquals(result, "already-set");
    assertEquals(Deno.env.get("__TEST_STUB_VAR__"), "already-set");
    Deno.env.delete("__TEST_STUB_VAR__");
  },
});

Deno.test({
  name: "stubSupabaseEnvVar: is idempotent across repeated calls",
  fn: () => {
    Deno.env.set("__TEST_STUB_VAR__", "");
    stubSupabaseEnvVar("__TEST_STUB_VAR__", "fallback-x");
    stubSupabaseEnvVar("__TEST_STUB_VAR__", "fallback-y"); // no-op now
    assertEquals(Deno.env.get("__TEST_STUB_VAR__"), "fallback-x");
    Deno.env.delete("__TEST_STUB_VAR__");
  },
});

Deno.test({
  name: "stubSupabaseEnv: rehydrates all three Supabase vars from empty CI secrets",
  fn: () => {
    Deno.env.set("SUPABASE_URL", "");
    Deno.env.set("SUPABASE_ANON_KEY", "");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "");

    const resolved = stubSupabaseEnv();

    assertEquals(resolved.SUPABASE_URL, __DEFAULT_STUBS_FOR_TEST.SUPABASE_URL);
    assertEquals(resolved.SUPABASE_ANON_KEY, __DEFAULT_STUBS_FOR_TEST.SUPABASE_ANON_KEY);
    assertEquals(
      resolved.SUPABASE_SERVICE_ROLE_KEY,
      __DEFAULT_STUBS_FOR_TEST.SUPABASE_SERVICE_ROLE_KEY,
    );
    assertEquals(Deno.env.get("SUPABASE_URL"), __DEFAULT_STUBS_FOR_TEST.SUPABASE_URL);
  },
});

Deno.test({
  name: "stubSupabaseEnv: per-key overrides win over defaults",
  fn: () => {
    Deno.env.set("SUPABASE_URL", "");
    Deno.env.set("SUPABASE_ANON_KEY", "");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "");

    const resolved = stubSupabaseEnv({ SUPABASE_URL: "http://custom.local" });
    assertEquals(resolved.SUPABASE_URL, "http://custom.local");
    assertEquals(Deno.env.get("SUPABASE_URL"), "http://custom.local");
    // Untouched keys fall back to defaults.
    assertEquals(resolved.SUPABASE_ANON_KEY, __DEFAULT_STUBS_FOR_TEST.SUPABASE_ANON_KEY);
  },
});

// MUST sort last in this file. Deno runs all discovered test files in a
// single process, so any SUPABASE_* var we mutated above would otherwise
// leak into later test files (e.g. tenant-assets-storage-rls.test.ts),
// which then treat the stub URL as real and attempt a live DNS lookup
// to http://custom.local. Restoring the snapshot puts the process env
// back to whatever CI/.env had at module load.
Deno.test("zz_restore_supabase_env_for_subsequent_files", () => {
  restoreSupabaseEnv();
});

