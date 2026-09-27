// Live integration test: a business must always keep at least one approved
// owner or admin. Uses a throwaway business with temporary logins, changes
// them through the DEPLOYED admin-users function and directly in the real
// database, and checks the last manager can never be demoted, deactivated
// (is_approved = false) or removed. Everything is deleted at the end.
//
// Needs: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or anon key) and
// SUPABASE_SERVICE_ROLE_KEY. Without the service key it is skipped.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ENABLED = !!URL_BASE && !!KEY && !!SERVICE;
const LAST_ADMIN = "A business must keep at least one owner or admin";

async function call(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${URL_BASE}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

async function makeUser(admin: SupabaseClient, label: string) {
  const email = `e2e-last-admin-${label}-${crypto.randomUUID()}@mimmobook.local`;
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
  name: "admin-users live: the last owner or admin cannot be demoted, deactivated or removed",
  ignore: !ENABLED,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const admin = createClient(URL_BASE!, SERVICE!, { auth: { persistSession: false } });
    const users: string[] = [];
    let tenantId: string | null = null;
    try {
      const a = await makeUser(admin, "owner");
      users.push(a.id);
      const b = await makeUser(admin, "second");
      users.push(b.id);

      const slug = `ci-last-admin-${crypto.randomUUID().slice(0, 8)}`;
      const { data: tenant, error: tErr } = await admin
        .from("tenants")
        .insert({ name: "CI last admin test", slug, owner_user_id: a.id })
        .select("id")
        .single();
      if (tErr || !tenant) throw tErr ?? new Error("tenant not created");
      tenantId = tenant.id;

      const { error: mErr } = await admin
        .from("tenant_users")
        .insert({ user_id: a.id, tenant_id: tenantId, role: "owner", is_approved: true });
      if (mErr) throw mErr;

      const roleOf = async (id: string) => {
        const { data, error } = await admin
          .from("tenant_users")
          .select("role, is_approved")
          .eq("user_id", id)
          .eq("tenant_id", tenantId!);
        if (error) throw error;
        return data;
      };
      const tokenA = await signIn(a.email, a.password);

      // 1. Sole owner demotes themselves through staff management: refused.
      let r = await call(tokenA, { action: "update_role", userId: a.id, role: "staff" });
      assertEquals(r.status, 400, r.text);
      assert(r.text.includes(LAST_ADMIN), `expected the last-admin message, got ${r.text}`);
      assertEquals(await roleOf(a.id), [{ role: "owner", is_approved: true }]);

      // 2. Direct database changes to the sole owner are refused too.
      const dbTries = [
        admin.from("tenant_users").update({ role: "staff" }).eq("user_id", a.id).eq("tenant_id", tenantId),
        admin.from("tenant_users").update({ is_approved: false }).eq("user_id", a.id).eq("tenant_id", tenantId),
        admin.from("tenant_users").delete().eq("user_id", a.id).eq("tenant_id", tenantId),
      ];
      for (const [i, q] of dbTries.entries()) {
        const { error } = await q;
        assert(error?.message.includes("LAST_TENANT_ADMIN"), `db change ${i} should be refused: ${error?.message}`);
      }
      assertEquals(await roleOf(a.id), [{ role: "owner", is_approved: true }]);

      // 3. With a second admin present, the owner may step down (control).
      const { error: bErr } = await admin
        .from("tenant_users")
        .insert({ user_id: b.id, tenant_id: tenantId, role: "admin", is_approved: true });
      if (bErr) throw bErr;
      r = await call(tokenA, { action: "update_role", userId: a.id, role: "staff" });
      assertEquals(r.status, 200, `owner should step down when an admin remains: ${r.text}`);

      // 4. Now the admin is the last manager: demoting themselves is refused.
      const tokenB = await signIn(b.email, b.password);
      r = await call(tokenB, { action: "update_role", userId: b.id, role: "staff" });
      assertEquals(r.status, 400, r.text);
      assert(r.text.includes(LAST_ADMIN), `expected the last-admin message, got ${r.text}`);
      assertEquals(await roleOf(b.id), [{ role: "admin", is_approved: true }]);

      // 5. Two managers demoted at the same time: exactly one change wins.
      const { error: upErr } = await admin
        .from("tenant_users")
        .update({ role: "owner" })
        .eq("user_id", a.id)
        .eq("tenant_id", tenantId);
      if (upErr) throw upErr;
      const results = await Promise.all(
        [a.id, b.id].map((id) =>
          admin.from("tenant_users").update({ role: "staff" }).eq("user_id", id).eq("tenant_id", tenantId!),
        ),
      );
      const failures = results.filter((x) => x.error?.message.includes("LAST_TENANT_ADMIN")).length;
      assertEquals(failures, 1, `exactly one simultaneous demotion should be refused: ${JSON.stringify(results.map((x) => x.error?.message))}`);
      const { data: managers } = await admin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .in("role", ["owner", "admin", "superadmin"])
        .eq("is_approved", true);
      assertEquals(managers?.length, 1, "one manager must remain");
    } finally {
      // Deleting the whole business is still allowed and removes its members.
      if (tenantId) {
        const { error } = await admin.from("tenants").delete().eq("id", tenantId);
        if (error) console.error("cleanup: could not delete test business", tenantId, error.message);
      }
      for (const id of users) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) console.error("cleanup: could not delete temporary user", id, error.message);
      }
    }
  },
});
