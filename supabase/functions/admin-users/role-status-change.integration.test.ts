// Live integration test: changes a temporary user's role and account status
// in the real database, then checks the DEPLOYED admin-users function applies
// each change on the very next request (same sign-in, no new login).
//
// Needs: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or anon key) and
// SUPABASE_SERVICE_ROLE_KEY (CI secret). Optional: ADMIN_USERS_TEST_TENANT_ID
// (defaults to the E2E test business). Without the service key it is skipped.
//
// A throwaway user is created for every run and always deleted at the end.
import { createClient } from "npm:@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TENANT = Deno.env.get("ADMIN_USERS_TEST_TENANT_ID") ?? "9ac05fbf-0834-44fd-a52a-d030b7074a30";
const ENABLED = !!URL_BASE && !!KEY && !!SERVICE;

async function list(token: string) {
  const res = await fetch(`${URL_BASE}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
    },
    body: JSON.stringify({ action: "list" }),
  });
  return { status: res.status, text: await res.text() };
}

const refused = (r: { status: number }) => r.status === 401 || r.status === 403;

Deno.test({
  name: "admin-users live: role and account changes apply on the next request",
  ignore: !ENABLED,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const admin = createClient(URL_BASE!, SERVICE!, { auth: { persistSession: false } });
    const email = `e2e-role-change-${crypto.randomUUID()}@mimmobook.local`;
    const password = crypto.randomUUID() + "Aa1!"; // 40 chars, under the 72 limit
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) throw createErr ?? new Error("user not created");
    const userId = created.user.id;

    const setRole = async (role: "owner" | "admin" | "staff") => {
      const { error } = await admin.from("tenant_users").update({ role }).eq("user_id", userId);
      if (error) throw error;
    };

    try {
      const { error: memberErr } = await admin
        .from("tenant_users")
        .insert({ user_id: userId, tenant_id: TENANT, role: "admin", is_approved: true });
      if (memberErr) throw memberErr;

      const anon = createClient(URL_BASE!, KEY!, { auth: { persistSession: false } });
      const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });
      if (signErr || !signIn.session) throw signErr ?? new Error("no session");
      const token = signIn.session.access_token;

      // 1. Admin: allowed.
      let r = await list(token);
      assertEquals(r.status, 200, `admin should be allowed: ${r.text}`);

      // 2. Demoted to staff: the same sign-in is refused right away.
      await setRole("staff");
      r = await list(token);
      assert(refused(r), `staff should be refused, got ${r.status}: ${r.text}`);

      // 3. Promoted back to admin: allowed right away.
      await setRole("admin");
      r = await list(token);
      assertEquals(r.status, 200, `re-promoted admin should be allowed: ${r.text}`);

      // 4. Promoted to owner: still allowed.
      await setRole("owner");
      r = await list(token);
      assertEquals(r.status, 200, `owner should be allowed: ${r.text}`);

      // 5. Removed from the business: refused.
      const { error: delErr } = await admin.from("tenant_users").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      r = await list(token);
      assert(refused(r), `removed member should be refused, got ${r.status}: ${r.text}`);

      // 6. Re-added as admin, then the account is disabled: refused as not signed in.
      const { error: readdErr } = await admin
        .from("tenant_users")
        .insert({ user_id: userId, tenant_id: TENANT, role: "admin", is_approved: true });
      if (readdErr) throw readdErr;
      r = await list(token);
      assertEquals(r.status, 200, `re-added admin should be allowed: ${r.text}`);

      const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: "24h" });
      if (banErr) throw banErr;
      r = await list(token);
      assertEquals(r.status, 401, `disabled account should be refused as not signed in: ${r.text}`);
    } finally {
      await admin.from("site_users").delete().eq("user_id", userId);
      await admin.from("tenant_users").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error("cleanup: could not delete temporary user", userId, error.message);
    }
  },
});
