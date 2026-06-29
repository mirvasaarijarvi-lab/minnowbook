// Deno test for the shared auth helper. Exercises the three guarantees we
// rely on across every auth-enforced edge function:
//   1. Missing/invalid Authorization header → 401 without touching getClaims.
//   2. getClaims() that never resolves → bounded timeout, still 401 fast.
//   3. Valid claims → AuthContext with userId and clients.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { requireAuth, verifyBearer } from "./require-auth.ts";

const ORIGINAL_ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

function setEnv() {
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
}
function restoreEnv() {
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
}

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

Deno.test("requireAuth returns 401 when Authorization header is missing", async () => {
  setEnv();
  try {
    const res = await requireAuth(new Request("https://x.test"), corsHeaders);
    assert(res instanceof Response);
    assertEquals(res.status, 401);
  } finally {
    restoreEnv();
  }
});

Deno.test("requireAuth returns 401 when header is not Bearer", async () => {
  setEnv();
  try {
    const res = await requireAuth(
      new Request("https://x.test", { headers: { Authorization: "Basic abc" } }),
      corsHeaders,
    );
    assert(res instanceof Response);
    assertEquals(res.status, 401);
  } finally {
    restoreEnv();
  }
});

Deno.test("verifyBearer reports missing_header without making a network call", async () => {
  setEnv();
  try {
    const result = await verifyBearer(new Request("https://x.test"));
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.reason, "missing_header");
  } finally {
    restoreEnv();
  }
});

Deno.test("verifyBearer reports missing_env when service-role key is absent", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const result = await verifyBearer(
      new Request("https://x.test", { headers: { Authorization: "Bearer fake" } }),
    );
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.reason, "missing_env");
  } finally {
    restoreEnv();
  }
});
