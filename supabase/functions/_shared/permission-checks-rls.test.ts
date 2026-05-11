/**
 * Regression tests for the tenant-scoped permission helpers:
 *   public.has_tenant_role(p_user_id, p_role, p_tenant_id)
 *   public.has_permission(p_user_id, p_permission, p_tenant_id)
 *
 * Asserts:
 *  1. The legacy 2-arg overloads NO LONGER EXIST (PostgREST returns
 *     PGRST202 / "Could not find the function ... in the schema cache").
 *  2. has_tenant_role(...) is correctly tenant-scoped:
 *       - returns true for the user's own tenant + role
 *       - returns false for the same user against a DIFFERENT tenant
 *       - returns false for a wrong role in the user's own tenant
 *  3. has_permission(...) is correctly tenant-scoped:
 *       - owner shortcut applies only inside the owner's tenant
 *       - role_permissions seeded in tenant A grant the permission in
 *         tenant A but NOT in tenant B (cross-tenant leakage check)
 *       - unknown permission returns false
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY. Skipped gracefully otherwise.
 */
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

const SHOULD_RUN = SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY;

interface Ctx {
  ownerUserId: string;
  ownerEmail: string;
  ownerPassword: string;
  staffUserId: string;
  staffEmail: string;
  staffPassword: string;
  tenantA: string;
  tenantB: string;
}

// deno-lint-ignore no-explicit-any
async function provision(admin: any): Promise<Ctx> {
  const tag = crypto.randomUUID().slice(0, 8);
  const mk = async (label: string) => {
    const email = `perm-${label}-${tag}@example.test`;
    const password = `Pw_${crypto.randomUUID()}_Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);
    return { id: data.user.id as string, email, password };
  };

  const owner = await mk("owner");
  const staff = await mk("staff");

  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();

  const { error: tAErr } = await admin.from("tenants").insert({
    id: tenantA,
    name: `Perm A ${tag}`,
    slug: `perm-a-${tag}`,
    tier: "professional",
    owner_user_id: owner.id,
    subscription_status: "trialing",
  });
  if (tAErr) throw new Error(`insert tenantA: ${tAErr.message}`);

  const { error: tBErr } = await admin.from("tenants").insert({
    id: tenantB,
    name: `Perm B ${tag}`,
    slug: `perm-b-${tag}`,
    tier: "basic",
    subscription_status: "trialing",
  });
  if (tBErr) throw new Error(`insert tenantB: ${tBErr.message}`);

  // Owner -> tenantA owner; Staff -> tenantA staff. Neither has membership in tenantB.
  const { error: ownErr } = await admin.from("tenant_users").insert({
    tenant_id: tenantA,
    user_id: owner.id,
    role: "owner",
    is_approved: true,
  });
  if (ownErr) throw new Error(`tenant_users owner: ${ownErr.message}`);

  const { error: stErr } = await admin.from("tenant_users").insert({
    tenant_id: tenantA,
    user_id: staff.id,
    role: "staff",
    is_approved: true,
  });
  if (stErr) throw new Error(`tenant_users staff: ${stErr.message}`);

  // Seed a role_permission for staff in tenantA only.
  const { error: rpErr } = await admin.from("role_permissions").insert({
    tenant_id: tenantA,
    role_key: "staff",
    permission: "reservations.create",
  });
  if (rpErr) throw new Error(`role_permissions: ${rpErr.message}`);

  return {
    ownerUserId: owner.id,
    ownerEmail: owner.email,
    ownerPassword: owner.password,
    staffUserId: staff.id,
    staffEmail: staff.email,
    staffPassword: staff.password,
    tenantA,
    tenantB,
  };
}

// deno-lint-ignore no-explicit-any
async function cleanup(admin: any, ctx: Ctx) {
  await admin.from("role_permissions").delete().in("tenant_id", [
    ctx.tenantA,
    ctx.tenantB,
  ]);
  await admin.from("tenant_users").delete().in("user_id", [
    ctx.ownerUserId,
    ctx.staffUserId,
  ]);
  await admin.from("tenants").delete().in("id", [ctx.tenantA, ctx.tenantB]);
  await admin.auth.admin.deleteUser(ctx.ownerUserId).catch(() => undefined);
  await admin.auth.admin.deleteUser(ctx.staffUserId).catch(() => undefined);
}

// deno-lint-ignore no-explicit-any
async function signIn(email: string, password: string): Promise<any> {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  assertEquals(error, null, `sign-in failed for ${email}: ${error?.message}`);
  return c;
}

Deno.test({
  name: "permission helpers: legacy 2-arg overloads no longer exist",
  ignore: !SHOULD_RUN,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const ctx = await provision(admin);
    try {
      const client = await signIn(ctx.ownerEmail, ctx.ownerPassword);

      // 2-arg has_permission must be gone.
      const { error: hpErr } = await client.rpc("has_permission", {
        p_user_id: ctx.ownerUserId,
        p_permission: "reservations.create",
      });
      assert(
        hpErr,
        "expected 2-arg has_permission(uuid,text) to be removed",
      );
      assert(
        /Could not find the function|PGRST202|does not exist/i.test(
          `${hpErr?.message ?? ""} ${(hpErr as any)?.code ?? ""}`,
        ),
        `unexpected error shape for 2-arg has_permission: ${JSON.stringify(hpErr)}`,
      );

      // 2-arg has_tenant_role must be gone.
      const { error: htrErr } = await client.rpc("has_tenant_role", {
        p_user_id: ctx.ownerUserId,
        p_role: "owner",
      });
      assert(
        htrErr,
        "expected 2-arg has_tenant_role(uuid,app_role) to be removed",
      );
      assert(
        /Could not find the function|PGRST202|does not exist/i.test(
          `${htrErr?.message ?? ""} ${(htrErr as any)?.code ?? ""}`,
        ),
        `unexpected error shape for 2-arg has_tenant_role: ${JSON.stringify(htrErr)}`,
      );
    } finally {
      await cleanup(admin, ctx);
    }
  },
});

Deno.test({
  name: "has_tenant_role(3-arg) is tenant-scoped across tenants",
  ignore: !SHOULD_RUN,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const ctx = await provision(admin);
    try {
      const client = await signIn(ctx.ownerEmail, ctx.ownerPassword);

      // Owner of tenantA -> true for (owner, A).
      const ownerInA = await client.rpc("has_tenant_role", {
        p_user_id: ctx.ownerUserId,
        p_role: "owner",
        p_tenant_id: ctx.tenantA,
      });
      assertEquals(ownerInA.error, null, ownerInA.error?.message);
      assertEquals(ownerInA.data, true, "owner should be 'owner' in tenantA");

      // Same user, different tenant -> false (cross-tenant isolation).
      const ownerInB = await client.rpc("has_tenant_role", {
        p_user_id: ctx.ownerUserId,
        p_role: "owner",
        p_tenant_id: ctx.tenantB,
      });
      assertEquals(ownerInB.error, null, ownerInB.error?.message);
      assertEquals(
        ownerInB.data,
        false,
        "owner of tenantA must NOT be 'owner' in tenantB",
      );

      // Wrong role in own tenant -> false.
      const wrongRole = await client.rpc("has_tenant_role", {
        p_user_id: ctx.ownerUserId,
        p_role: "staff",
        p_tenant_id: ctx.tenantA,
      });
      assertEquals(wrongRole.error, null, wrongRole.error?.message);
      assertEquals(
        wrongRole.data,
        false,
        "owner role row should not satisfy 'staff' check",
      );

      // Staff in tenantA -> true; staff in tenantB -> false.
      const staffClient = await signIn(ctx.staffEmail, ctx.staffPassword);
      const staffInA = await staffClient.rpc("has_tenant_role", {
        p_user_id: ctx.staffUserId,
        p_role: "staff",
        p_tenant_id: ctx.tenantA,
      });
      assertEquals(staffInA.data, true, "staff should be 'staff' in tenantA");

      const staffInB = await staffClient.rpc("has_tenant_role", {
        p_user_id: ctx.staffUserId,
        p_role: "staff",
        p_tenant_id: ctx.tenantB,
      });
      assertEquals(
        staffInB.data,
        false,
        "staff of tenantA must NOT be 'staff' in tenantB",
      );
    } finally {
      await cleanup(admin, ctx);
    }
  },
});

Deno.test({
  name: "has_permission(3-arg) is tenant-scoped and blocks cross-tenant leakage",
  ignore: !SHOULD_RUN,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const ctx = await provision(admin);
    try {
      // ---- Owner shortcut is tenant-scoped ----
      const ownerClient = await signIn(ctx.ownerEmail, ctx.ownerPassword);

      const ownerInA = await ownerClient.rpc("has_permission", {
        p_user_id: ctx.ownerUserId,
        p_permission: "reservations.create",
        p_tenant_id: ctx.tenantA,
      });
      assertEquals(ownerInA.error, null, ownerInA.error?.message);
      assertEquals(
        ownerInA.data,
        true,
        "owner of tenantA should have any permission inside tenantA",
      );

      const ownerInB = await ownerClient.rpc("has_permission", {
        p_user_id: ctx.ownerUserId,
        p_permission: "reservations.create",
        p_tenant_id: ctx.tenantB,
      });
      assertEquals(ownerInB.error, null, ownerInB.error?.message);
      assertEquals(
        ownerInB.data,
        false,
        "owner of tenantA must NOT inherit permissions in tenantB",
      );

      // ---- role_permissions are tenant-scoped ----
      const staffClient = await signIn(ctx.staffEmail, ctx.staffPassword);

      const staffInA = await staffClient.rpc("has_permission", {
        p_user_id: ctx.staffUserId,
        p_permission: "reservations.create",
        p_tenant_id: ctx.tenantA,
      });
      assertEquals(staffInA.error, null, staffInA.error?.message);
      assertEquals(
        staffInA.data,
        true,
        "staff in tenantA should have seeded permission in tenantA",
      );

      const staffInB = await staffClient.rpc("has_permission", {
        p_user_id: ctx.staffUserId,
        p_permission: "reservations.create",
        p_tenant_id: ctx.tenantB,
      });
      assertEquals(staffInB.error, null, staffInB.error?.message);
      assertEquals(
        staffInB.data,
        false,
        "permission seeded in tenantA must NOT leak into tenantB",
      );

      // Unknown permission -> false even in own tenant.
      const unknown = await staffClient.rpc("has_permission", {
        p_user_id: ctx.staffUserId,
        p_permission: "nonexistent.permission",
        p_tenant_id: ctx.tenantA,
      });
      assertEquals(unknown.error, null, unknown.error?.message);
      assertEquals(
        unknown.data,
        false,
        "unknown permission should return false",
      );
    } finally {
      await cleanup(admin, ctx);
    }
  },
});

if (!SHOULD_RUN) {
  console.warn(
    "[permission-checks-rls] SKIPPED: set SUPABASE_URL, SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY), and SUPABASE_SERVICE_ROLE_KEY to run.",
  );
}
