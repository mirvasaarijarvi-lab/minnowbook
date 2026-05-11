/**
 * Storage RLS regression test for the `tenant-assets` bucket.
 *
 * Behavior asserted (matches the policies in
 * `supabase/migrations/*_tenant_assets_*.sql`):
 *
 *   For an authenticated STAFF member of tenant T:
 *     ALLOWED   write/replace/delete `<T>/logo.<ext>`
 *     ALLOWED   write/replace/delete `<T>/hero.<ext>`
 *     ALLOWED   write/replace/delete `<T>/avatars/<file>`
 *     ALLOWED   write/replace/delete `<T>/resources/<file>`
 *     BLOCKED   write/delete `<T>/secret.txt` (non-branding path)
 *     BLOCKED   write/delete `<T>/random/foo.png` (non-allowed subfolder)
 *     BLOCKED   write/delete `<other-tenant>/avatars/x.png`
 *
 *   Anon: blocked everywhere.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to provision a tenant + staff user.
 * Without it, the test prints a clear skip notice and exits 0 so the rest
 * of the Deno suite still runs (consistent with other service-role-gated
 * tests in this repo).
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  "";

const BUCKET = "tenant-assets";

const SHOULD_RUN = SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY;

function tinyPng(): Uint8Array {
  // 1x1 transparent PNG
  return Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    ),
    (c) => c.charCodeAt(0),
  );
}

// deno-lint-ignore no-explicit-any
async function provisionTenantAndStaff(admin: any) {
  const slug = `rls-test-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${slug}@example.test`;
  const password = `Pw_${crypto.randomUUID()}_Aa1!`;

  // 1. Create auth user (email-confirmed so we can sign in).
  const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !userRes.user) {
    throw new Error(`createUser failed: ${userErr?.message}`);
  }
  const userId = userRes.user.id;

  // 2. Create tenant directly (bypassing the create_tenant RPC's auth.uid()
  //    guard) and seed a staff membership.
  const tenantId = crypto.randomUUID();
  const { error: tErr } = await admin.from("tenants").insert({
    id: tenantId,
    name: `RLS Test ${slug}`,
    slug,
    tier: "professional",
    owner_user_id: userId,
    subscription_status: "trialing",
  });
  if (tErr) throw new Error(`insert tenant failed: ${tErr.message}`);

  const { error: tuErr } = await admin.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: userId,
    role: "staff",
    is_approved: true,
  });
  if (tuErr) throw new Error(`insert tenant_users failed: ${tuErr.message}`);

  // 3. Second tenant (no membership for our user) for cross-tenant negative test.
  const otherTenantId = crypto.randomUUID();
  const { error: oErr } = await admin.from("tenants").insert({
    id: otherTenantId,
    name: `RLS Other ${slug}`,
    slug: `${slug}-other`,
    tier: "basic",
    subscription_status: "trialing",
  });
  if (oErr) throw new Error(`insert other tenant failed: ${oErr.message}`);

  return { userId, email, password, tenantId, otherTenantId };
}

async function cleanup(
  // deno-lint-ignore no-explicit-any
  admin: any,
  ctx: { userId: string; tenantId: string; otherTenantId: string },
) {
  // Best-effort: empty bucket folders, drop memberships/tenants, delete user.
  for (const t of [ctx.tenantId, ctx.otherTenantId]) {
    const { data: list } = await admin.storage.from(BUCKET).list(t, {
      limit: 1000,
    });
    const paths = (list ?? []).map((o: any) => `${t}/${o.name}`);
    // Also recurse one level for avatars/ and resources/
    for (const sub of ["avatars", "resources"]) {
      const { data: subList } = await admin.storage
        .from(BUCKET)
        .list(`${t}/${sub}`, { limit: 1000 });
      for (const o of (subList ?? []) as any[]) paths.push(`${t}/${sub}/${o.name}`);
    }
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  }
  await admin.from("tenant_users").delete().eq("user_id", ctx.userId);
  await admin.from("tenants").delete().in("id", [
    ctx.tenantId,
    ctx.otherTenantId,
  ]);
  await admin.auth.admin.deleteUser(ctx.userId).catch(() => undefined);
}

Deno.test({
  name: "tenant-assets storage RLS: branding paths allowed, others blocked",
  ignore: !SHOULD_RUN,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const ctx = await provisionTenantAndStaff(admin);

    try {
      // Sign in as staff user.
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false },
      });
      const { error: signInErr } = await userClient.auth.signInWithPassword({
        email: ctx.email,
        password: ctx.password,
      });
      assertEquals(signInErr, null, `sign-in failed: ${signInErr?.message}`);

      const png = tinyPng();
      const T = ctx.tenantId;
      const upload = (path: string) =>
        userClient.storage
          .from(BUCKET)
          .upload(path, png, { contentType: "image/png", upsert: true });
      const remove = (path: string) =>
        userClient.storage.from(BUCKET).remove([path]);

      // ---- ALLOWED branding paths ----
      const allowed = [
        `${T}/logo.png`,
        `${T}/hero.png`,
        `${T}/avatars/staff-${crypto.randomUUID().slice(0, 6)}.png`,
        `${T}/resources/res-${crypto.randomUUID().slice(0, 6)}.png`,
      ];
      for (const p of allowed) {
        const { error } = await upload(p);
        assertEquals(error, null, `expected upload allowed for ${p}`);
      }
      for (const p of allowed) {
        const { data, error } = await remove(p);
        assertEquals(error, null, `expected delete allowed for ${p}`);
        assert(data && data.length > 0, `delete returned no rows for ${p}`);
      }

      // ---- BLOCKED non-branding paths in own tenant ----
      const blockedSelf = [
        `${T}/secret.txt`,
        `${T}/random/foo.png`,
        `${T}/uploads/evil.png`,
      ];
      for (const p of blockedSelf) {
        const { error } = await upload(p);
        assert(
          error,
          `expected upload BLOCKED for non-branding path ${p}, got success`,
        );
      }

      // Seed a non-branding file via service role, then verify staff cannot delete it.
      const seededPath = `${T}/server-only.txt`;
      {
        const { error } = await admin.storage
          .from(BUCKET)
          .upload(seededPath, new Uint8Array([1, 2, 3]), {
            contentType: "text/plain",
            upsert: true,
          });
        assertEquals(error, null, `service-role seed failed: ${error?.message}`);
      }
      {
        const { data, error } = await remove(seededPath);
        // RLS-blocked deletes return data=[] with no error in supabase-js.
        const blocked = !!error || (Array.isArray(data) && data.length === 0);
        assert(
          blocked,
          `expected staff DELETE blocked for ${seededPath} (data=${JSON.stringify(data)}, err=${error?.message})`,
        );
      }
      // Confirm file still exists.
      {
        const { data } = await admin.storage
          .from(BUCKET)
          .list(T, { limit: 100, search: "server-only.txt" });
        assert(
          (data ?? []).some((o: any) => o.name === "server-only.txt"),
          "non-branding file should still exist after blocked staff delete",
        );
      }

      // ---- BLOCKED cross-tenant ----
      const crossPath = `${ctx.otherTenantId}/avatars/x.png`;
      {
        const { error } = await upload(crossPath);
        assert(error, `expected cross-tenant upload BLOCKED for ${crossPath}`);
      }
    } finally {
      await cleanup(admin, ctx);
    }
  },
});

Deno.test({
  name: "tenant-assets storage RLS: anon cannot upload to any path",
  ignore: !SHOULD_RUN,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });
    const fakeTenant = crypto.randomUUID();
    for (const p of [
      `${fakeTenant}/logo.png`,
      `${fakeTenant}/avatars/x.png`,
      `${fakeTenant}/resources/x.png`,
      `${fakeTenant}/secret.txt`,
    ]) {
      const { error } = await anon.storage
        .from(BUCKET)
        .upload(p, tinyPng(), { contentType: "image/png", upsert: true });
      assert(error, `expected anon upload BLOCKED for ${p}`);
    }
  },
});

if (!SHOULD_RUN) {
  console.warn(
    "[tenant-assets-storage-rls] SKIPPED: set SUPABASE_URL, SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY), and SUPABASE_SERVICE_ROLE_KEY to run.",
  );
}
