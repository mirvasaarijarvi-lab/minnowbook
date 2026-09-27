// Live integration test: two temporary admins in the same business. Only the
// first one's role and account status are changed in the real database; after
// every change the SECOND admin must keep full staff-management access with the
// same sign-in, and their own membership row must be untouched.
//
// Needs: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or anon key) and
// SUPABASE_SERVICE_ROLE_KEY (CI secret). Optional: ADMIN_USERS_TEST_TENANT_ID.
// Without the service key it is skipped. Both users are always deleted at the end.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
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

async function makeAdmin(admin: SupabaseClient, label: string) {
  const email = `e2e-role-iso-${label}-${crypto.randomUUID()}@mimmobook.local`;
  const password = crypto.randomUUID() + "Aa1!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("user not created");
  return { id: data.user.id, email, password };
}

async function signIn(email: string, password: string) {
  const anon = createClient(URL_BASE!, KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("no session");
  return data.session.access_token;
}

Deno.test({
  name: "admin-users live: changing one user's role or status leaves another admin's access intact",
  ignore: !ENABLED,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const admin = createClient(URL_BASE!, SERVICE!, { auth: { persistSession: false } });
    const created: string[] = [];
    try {
      const a = await makeAdmin(admin, "changed");
      created.push(a.id);
      const b = await makeAdmin(admin, "bystander");
      created.push(b.id);

      const { error: memberErr } = await admin.from("tenant_users").insert([
        { user_id: a.id, tenant_id: TENANT, role: "admin", is_approved: true },
        { user_id: b.id, tenant_id: TENANT, role: "admin", is_approved: true },
      ]);
      if (memberErr) throw memberErr;

      const tokenA = await signIn(a.email, a.password);
      const tokenB = await signIn(b.email, b.password);

      const bystanderRow = async () => {
        const { data, error } = await admin
          .from("tenant_users")
          .select("role, is_approved, tenant_id")
          .eq("user_id", b.id);
        if (error) throw error;
        return data;
      };
      const before = await bystanderRow();
      assertEquals(before, [{ role: "admin", is_approved: true, tenant_id: TENANT }]);

      const checkBystander = async (step: string) => {
        const r = await list(tokenB);
        assertEquals(r.status, 200, `after "${step}", the other admin should still be allowed: ${r.text}`);
        assertEquals(await bystanderRow(), before, `after "${step}", the other admin's membership changed`);
      };

      await checkBystander("start");
      assertEquals((await list(tokenA)).status, 200, "first admin should start allowed");

      const setRoleA = async (role: "owner" | "admin" | "staff") => {
        const { error } = await admin.from("tenant_users").update({ role }).eq("user_id", a.id);
        if (error) throw error;
      };

      await setRoleA("staff");
      assert(refused(await list(tokenA)), "demoted user should be refused");
      await checkBystander("first user moved down to staff");

      await setRoleA("owner");
      assertEquals((await list(tokenA)).status, 200, "user made owner should be allowed");
      await checkBystander("first user made owner");

      const { error: delErr } = await admin.from("tenant_users").delete().eq("user_id", a.id);
      if (delErr) throw delErr;
      assert(refused(await list(tokenA)), "removed user should be refused");
      await checkBystander("first user removed from the business");

      const { error: banErr } = await admin.auth.admin.updateUserById(a.id, { ban_duration: "24h" });
      if (banErr) throw banErr;
      await checkBystander("first user's account turned off");

      const { error: delUserErr } = await admin.auth.admin.deleteUser(a.id);
      if (delUserErr) throw delUserErr;
      created.shift();
      await checkBystander("first user's account deleted");
    } finally {
      for (const id of created) {
        await admin.from("site_users").delete().eq("user_id", id);
        await admin.from("tenant_users").delete().eq("user_id", id);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) console.error("cleanup: could not delete temporary user", id, error.message);
      }
    }
  },
});
