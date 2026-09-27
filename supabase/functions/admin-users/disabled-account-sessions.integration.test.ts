// Live integration test: turning an account off must block its EXISTING
// sign-in straight away, in every protected area, without waiting for the
// sign-in token to expire. A temporary admin signs in once, we confirm each
// area works, turn the account off, and replay the very same sign-in.
//
// Areas checked with the same sign-in:
//   1. Staff management server feature (shared sign-in check, requireAuth)
//   2. Sign-in service user lookup (used by server features calling getUser)
//   3. Business bookings read straight from the database (row security)
//   4. Staff list read straight from the database (row security)
//   5. Manager permission check in the database (is_tenant_manager)
// Then the account is turned back on and access returns, proving the block
// comes from the account status and not a broken sign-in.
//
// Needs SUPABASE_URL, a publishable key and SUPABASE_SERVICE_ROLE_KEY; skipped
// without them. The temporary login is always deleted at the end.
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

type AreaResult = { area: string; allowed: boolean; detail: string };

async function probeAreas(token: string): Promise<AreaResult[]> {
  const out: AreaResult[] = [];

  const fn = await fetch(`${URL_BASE}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
    },
    body: JSON.stringify({ action: "list" }),
  });
  const fnText = await fn.text();
  out.push({ area: "staff management feature", allowed: fn.status === 200, detail: `${fn.status}` });
  void fnText;

  const me = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: KEY!, Authorization: `Bearer ${token}` },
  });
  await me.body?.cancel();
  out.push({ area: "sign-in service user lookup", allowed: me.status === 200, detail: `${me.status}` });

  const db = createClient(URL_BASE!, KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const res = await db.from("reservations").select("id").eq("tenant_id", TENANT).limit(1);
  out.push({
    area: "bookings in the database",
    allowed: !res.error && (res.data?.length ?? 0) > 0,
    detail: res.error ? res.error.message : `${res.data?.length ?? 0} rows`,
  });

  const staff = await db.from("tenant_users").select("user_id").eq("tenant_id", TENANT).limit(5);
  out.push({
    area: "staff list in the database",
    allowed: !staff.error && (staff.data?.length ?? 0) > 1,
    detail: staff.error ? staff.error.message : `${staff.data?.length ?? 0} rows`,
  });

  const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  const mgr = await db.rpc("is_tenant_manager", { p_user_id: claims.sub, p_tenant_id: TENANT });
  out.push({
    area: "manager permission check",
    allowed: !mgr.error && mgr.data === true,
    detail: mgr.error ? mgr.error.message : String(mgr.data),
  });

  return out;
}

Deno.test({
  name: "disabled account: its existing sign-in is blocked immediately in every protected area",
  ignore: !ENABLED,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const admin = createClient(URL_BASE!, SERVICE!, { auth: { persistSession: false } });
    const email = `ci-disabled-${crypto.randomUUID()}@mimmobook.local`;
    const password = `${crypto.randomUUID()}Aa1!${crypto.randomUUID()}`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) throw createErr;
    const userId = created.user!.id;

    try {
      const { error: tuErr } = await admin
        .from("tenant_users")
        .insert({ user_id: userId, tenant_id: TENANT, role: "admin", is_approved: true });
      if (tuErr) throw tuErr;

      const anon = createClient(URL_BASE!, KEY!, { auth: { persistSession: false } });
      const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });
      if (signErr) throw signErr;
      const token = signIn.session!.access_token;

      // Before: every area works with this sign-in.
      for (const r of await probeAreas(token)) {
        assert(r.allowed, `before turning off, "${r.area}" should work (${r.detail})`);
      }

      // Turn the account off. The token itself stays validly signed.
      const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: "24h" });
      if (banErr) throw banErr;

      const after = await probeAreas(token);
      const stillOpen = after.filter((r) => r.allowed);
      assertEquals(
        stillOpen.map((r) => `${r.area} (${r.detail})`),
        [],
        "these areas still let a turned-off account in with its old sign-in",
      );

      // Turn it back on: the same sign-in works again in the database and
      // the staff feature, so the block above came from the account status.
      const { error: unbanErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (unbanErr) throw unbanErr;
      const restored = await probeAreas(token);
      for (const r of restored.filter((x) => x.area !== "sign-in service user lookup")) {
        assert(r.allowed, `after turning back on, "${r.area}" should work again (${r.detail})`);
      }
    } finally {
      await admin.from("site_users").delete().eq("user_id", userId);
      await admin.from("tenant_users").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error("cleanup: could not delete temporary user", userId, error.message);
    }
  },
});
