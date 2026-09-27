// Safeguards for tests that switch the backend address to a fake one.
// 1. withRestoredEnv puts the real settings back even when a test fails.
// 2. Every test file that changes SUPABASE_URL / keys must restore them in a
//    `finally` block or an end-of-file restore test, so a failing test can
//    never leak a fake address into later test files.
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { snapshotEnv, withRestoredEnv } from "./test-env-guard.ts";

Deno.test("withRestoredEnv restores settings after a failing test", async () => {
  const restore = snapshotEnv();
  try {
    Deno.env.set("SUPABASE_URL", "https://real.example.test");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    await assertRejects(
      withRestoredEnv(() => {
        Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
        Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");
        throw new Error("step failed");
      }),
      Error,
      "step failed",
    );
    assertEquals(Deno.env.get("SUPABASE_URL"), "https://real.example.test");
    assertEquals(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), undefined);
  } finally {
    restore();
  }
});

Deno.test("withRestoredEnv restores settings after a failing async assertion", async () => {
  const restore = snapshotEnv();
  try {
    Deno.env.set("SUPABASE_URL", "https://real.example.test");
    await assertRejects(
      withRestoredEnv(async () => {
        Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
        await Promise.resolve();
        assert(false, "assertion failed");
      }),
    );
    assertEquals(Deno.env.get("SUPABASE_URL"), "https://real.example.test");
  } finally {
    restore();
  }
});

const ROOT = new URL("../", import.meta.url);
const CHANGES = /Deno\.env\.(set|delete)\(\s*["'`](SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)["'`]/;
const SAFE = [/\bfinally\s*\{/, /withRestoredEnv\(/, /restoreSupabaseEnv\(\)/];

async function* testFiles(dir: URL): AsyncGenerator<URL> {
  for await (const e of Deno.readDir(dir)) {
    const u = new URL(e.name + (e.isDirectory ? "/" : ""), dir);
    if (e.isDirectory && e.name !== "node_modules") yield* testFiles(u);
    else if (/(\.test|_test)\.ts$/.test(e.name)) yield u;
  }
}

Deno.test("every test that changes the backend address restores it on failure", async () => {
  const missing: string[] = [];
  let checked = 0;
  for await (const f of testFiles(ROOT)) {
    const src = await Deno.readTextFile(f);
    if (!CHANGES.test(src)) continue;
    checked++;
    if (!SAFE.some((re) => re.test(src))) missing.push(f.pathname.split("/functions/")[1]);
  }
  assert(checked > 10, `expected many env-changing test files, found ${checked}`);
  assertEquals(missing, [], `these tests change backend settings without a finally-restore: ${missing.join(", ")}`);
});
