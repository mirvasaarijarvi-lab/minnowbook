// Live regression test: calls the DEPLOYED admin-users function.
//
// Always runs (needs only the public URL + publishable key):
//   - no sign-in is refused with 401
// Runs when ADMIN_USERS_TEST_ACCESS_TOKEN (an owner/admin session token) is set:
//   - an owner can list staff (authorized access keeps working)
//   - assigning a location that is not in the caller's business is refused
//   - bulk-assigning such a location is refused
// The unknown location id is random, so no other business's data is touched,
// and the refused request never removes the caller's existing locations
// (the check runs before anything is deleted).
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const TOKEN = Deno.env.get("ADMIN_USERS_TEST_ACCESS_TOKEN");
const ENABLED = !!URL_BASE && !!KEY;

async function call(body: unknown, token?: string) {
  const res = await fetch(`${URL_BASE}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      apikey: KEY!,
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

function userIdFromToken(token: string): string {
  const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  return payload.sub;
}

const FOREIGN_SITE = crypto.randomUUID();

Deno.test({
  name: "admin-users live: request without sign-in is refused (401)",
  ignore: !ENABLED,
  fn: async () => {
    const r = await call({ action: "list" });
    assertEquals(r.status, 401, r.text);
  },
});

Deno.test({
  name: "admin-users live: owner can list staff",
  ignore: !ENABLED || !TOKEN,
  fn: async () => {
    const r = await call({ action: "list" }, TOKEN);
    assertEquals(r.status, 200, r.text);
    assert(Array.isArray(JSON.parse(r.text)), "list returns an array");
  },
});

Deno.test({
  name: "admin-users live: assigning a location outside the business is refused",
  ignore: !ENABLED || !TOKEN,
  fn: async () => {
    const r = await call(
      {
        action: "update_site_assignments",
        userId: userIdFromToken(TOKEN!),
        assignments: [{ siteId: FOREIGN_SITE, role: "staff" }],
      },
      TOKEN,
    );
    assert(r.status >= 400 && r.status < 500, `expected refusal, got ${r.status}: ${r.text}`);
    assert(!/"success"\s*:\s*true/.test(r.text), r.text);
  },
});

Deno.test({
  name: "admin-users live: bulk-assigning a location outside the business is refused",
  ignore: !ENABLED || !TOKEN,
  fn: async () => {
    const r = await call(
      {
        action: "bulk_site_assignments",
        siteId: FOREIGN_SITE,
        userIds: [userIdFromToken(TOKEN!)],
      },
      TOKEN,
    );
    assert(r.status >= 400 && r.status < 500, `expected refusal, got ${r.status}: ${r.text}`);
    assert(!/"success"\s*:\s*true/.test(r.text), r.text);
  },
});
