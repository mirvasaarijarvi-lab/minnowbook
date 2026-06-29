// Unit tests for the env-stub helpers in test-security-headers.ts.
//
// These helpers underpin every per-function 401 / short-circuit /
// security-headers suite. A regression here (e.g. empty-string inherited
// env vars being preserved as "") cascades into accidental 500s across
// dozens of edge-function tests, so the contract is locked here.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { coerceMissingEnv, withStubSupabaseEnv } from "./test-security-headers.ts";

const KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "LOVABLE_API_KEY",
] as const;

/** Snapshot + restore the env vars touched by these tests so one test
 *  can never leak state into another. */
function withSavedEnv<T>(fn: () => Promise<T> | T): () => Promise<T> {
  return async () => {
    const saved: Record<string, string | undefined> = {};
    for (const k of KEYS) saved[k] = Deno.env.get(k);
    try {
      return await fn();
    } finally {
      for (const k of KEYS) {
        if (typeof saved[k] === "string") Deno.env.set(k, saved[k]!);
        else Deno.env.delete(k);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// coerceMissingEnv
// ---------------------------------------------------------------------------

Deno.test("coerceMissingEnv: undefined -> undefined", () => {
  assertEquals(coerceMissingEnv(undefined), undefined);
});

Deno.test("coerceMissingEnv: empty string -> undefined", () => {
  assertEquals(coerceMissingEnv(""), undefined);
});

Deno.test("coerceMissingEnv: whitespace-only -> undefined", () => {
  assertEquals(coerceMissingEnv(" "), undefined);
  assertEquals(coerceMissingEnv("\t"), undefined);
  assertEquals(coerceMissingEnv("\n"), undefined);
  assertEquals(coerceMissingEnv(" \t\n  "), undefined);
});

Deno.test("coerceMissingEnv: non-empty string passes through verbatim", () => {
  assertEquals(coerceMissingEnv("abc"), "abc");
  assertEquals(coerceMissingEnv("stub-service-key"), "stub-service-key");
});

Deno.test("coerceMissingEnv: preserves leading/trailing whitespace on real values", () => {
  // We must NOT trim — a real token may include surrounding bytes that
  // the consumer (e.g. JWT parser) depends on. Trimming would silently
  // corrupt the value.
  assertEquals(coerceMissingEnv(" real "), " real ");
  assertEquals(coerceMissingEnv("\treal\n"), "\treal\n");
});

// ---------------------------------------------------------------------------
// withStubSupabaseEnv
// ---------------------------------------------------------------------------

Deno.test(
  "withStubSupabaseEnv: sets stubs when vars are unset, then unsets",
  withSavedEnv(async () => {
    for (const k of KEYS) Deno.env.delete(k);

    let seen: Record<string, string | undefined> = {};
    await withStubSupabaseEnv(async () => {
      for (const k of KEYS) seen[k] = Deno.env.get(k);
    })();

    assertEquals(seen.SUPABASE_URL, "https://stub.supabase.co");
    assertEquals(seen.SUPABASE_SERVICE_ROLE_KEY, "stub-service-key");
    assertEquals(seen.SUPABASE_ANON_KEY, "stub-anon-key");
    assertEquals(seen.LOVABLE_API_KEY, "stub-lovable-key");

    // Restored to "unset" afterwards.
    for (const k of KEYS) {
      assertEquals(Deno.env.get(k), undefined, `${k} should be unset after`);
    }
  }),
);

Deno.test(
  "withStubSupabaseEnv: replaces empty-string inherited values with stubs",
  withSavedEnv(async () => {
    // This is the original bug: CI injects masked secrets as "", which
    // would crash createClient with `supabaseKey is required.` before
    // the handler ever ran.
    for (const k of KEYS) Deno.env.set(k, "");

    let seen: Record<string, string | undefined> = {};
    await withStubSupabaseEnv(async () => {
      for (const k of KEYS) seen[k] = Deno.env.get(k);
    })();

    assert(seen.SUPABASE_SERVICE_ROLE_KEY && seen.SUPABASE_SERVICE_ROLE_KEY.length > 0);
    assertEquals(seen.SUPABASE_SERVICE_ROLE_KEY, "stub-service-key");
    assertEquals(seen.SUPABASE_URL, "https://stub.supabase.co");

    // Restored to the original "" (not deleted) because it was a string.
    for (const k of KEYS) assertEquals(Deno.env.get(k), "");
  }),
);

Deno.test(
  "withStubSupabaseEnv: replaces whitespace-only inherited values with stubs",
  withSavedEnv(async () => {
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "   ");
    Deno.env.set("SUPABASE_URL", "\t\n");
    Deno.env.delete("SUPABASE_ANON_KEY");
    Deno.env.delete("LOVABLE_API_KEY");

    let svc: string | undefined;
    let url: string | undefined;
    await withStubSupabaseEnv(async () => {
      svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      url = Deno.env.get("SUPABASE_URL");
    })();

    assertEquals(svc, "stub-service-key");
    assertEquals(url, "https://stub.supabase.co");
  }),
);

Deno.test(
  "withStubSupabaseEnv: preserves real inherited values verbatim",
  withSavedEnv(async () => {
    Deno.env.set("SUPABASE_URL", "https://real.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "real-service-key");
    Deno.env.set("SUPABASE_ANON_KEY", "real-anon-key");
    Deno.env.set("LOVABLE_API_KEY", "real-lovable-key");

    let seen: Record<string, string | undefined> = {};
    await withStubSupabaseEnv(async () => {
      for (const k of KEYS) seen[k] = Deno.env.get(k);
    })();

    assertEquals(seen.SUPABASE_URL, "https://real.supabase.co");
    assertEquals(seen.SUPABASE_SERVICE_ROLE_KEY, "real-service-key");
    assertEquals(seen.SUPABASE_ANON_KEY, "real-anon-key");
    assertEquals(seen.LOVABLE_API_KEY, "real-lovable-key");

    // Real values restored.
    for (const k of KEYS) assert(Deno.env.get(k)?.startsWith("real"));
  }),
);

Deno.test(
  "withStubSupabaseEnv: restores prior state even if fn throws",
  withSavedEnv(async () => {
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "original");
    Deno.env.delete("LOVABLE_API_KEY");

    const wrapped = withStubSupabaseEnv(async () => {
      throw new Error("boom");
    });

    let caught: unknown;
    try {
      await wrapped();
    } catch (e) {
      caught = e;
    }

    assert(caught instanceof Error && caught.message === "boom");
    assertEquals(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "original");
    assertEquals(Deno.env.get("LOVABLE_API_KEY"), undefined);
  }),
);

Deno.test(
  "withStubSupabaseEnv: returns the inner function's resolved value",
  withSavedEnv(async () => {
    for (const k of KEYS) Deno.env.delete(k);
    const result = await withStubSupabaseEnv(async () => 42)();
    assertEquals(result, 42);
  }),
);
