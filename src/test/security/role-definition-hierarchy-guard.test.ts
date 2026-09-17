/**
 * Privilege-escalation regression for tenant-managed custom roles.
 *
 * `is_custom_role_key_assignable_by_owner` gates which `custom_role_key`
 * an owner may attach to a `tenant_users` row, and it trusts
 * `role_definitions.hierarchy_level` — data that owners themselves can
 * write. Without a write-time guard an owner (or anyone who reached the
 * owner-managed policy) could mint a custom role at hierarchy_level 0 and
 * hand out owner-equivalent standing inside the tenant.
 *
 * The `validate_role_definition_hierarchy` BEFORE INSERT/UPDATE trigger
 * closes that: non-system role definitions must sit at hierarchy_level
 * >= 10 and may not reuse the reserved keys `owner`, `superadmin`, `admin`.
 *
 * This suite covers both halves:
 *   1. the write-time trigger (levels and reserved keys, insert AND update)
 *   2. the read-time assignability function, including the reserved keys,
 *      unknown keys and cross-tenant keys
 *   3. the end-to-end effect on `tenant_users.custom_role_key`
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY. Missing creds skip cleanly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

interface Seeded {
  tenantId: string;
  otherTenantId: string;
  safeKey: string;
  boundaryKey: string;
  staffUserId: string;
  otherTenantKey: string;
}

async function assignable(
  service: SupabaseClient,
  tenantId: string,
  key: string | null,
): Promise<boolean> {
  const { data, error } = await service.rpc("is_custom_role_key_assignable_by_owner", {
    _tenant_id: tenantId,
    _custom_role_key: key,
  });
  if (error) throw error;
  return data as boolean;
}

describe.runIf(canRun)("custom role definition hierarchy guard", () => {
  let service: SupabaseClient;
  let seeded: Seeded | null = null;
  let stamp = 0;

  beforeAll(async () => {
    service = newService();
    stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);

    async function makeTenant(label: string): Promise<string> {
      const { data, error } = await service
        .from("tenants")
        .insert({
          name: `CI RoleGuard ${label} ${stamp}`,
          slug: `ci-roleguard-${label}-${stamp}-${rand}`,
          tier: "business",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error(`tenant insert failed for ${label}`);
      return data.id as string;
    }

    const tenantId = await makeTenant("main");
    const otherTenantId = await makeTenant("other");

    const safeKey = `ci_safe_${stamp}`;
    const boundaryKey = `ci_boundary_${stamp}`;
    const otherTenantKey = `ci_other_${stamp}`;

    const seeds: Array<[string, string, number]> = [
      [tenantId, safeKey, 20],
      [tenantId, boundaryKey, 10],
      [otherTenantId, otherTenantKey, 20],
    ];
    for (const [tid, key, level] of seeds) {
      const { error } = await service.from("role_definitions").insert({
        tenant_id: tid,
        role_key: key,
        display_name: key,
        hierarchy_level: level,
        is_system: false,
      });
      if (error) throw error;
    }

    // A staff user in the main tenant, used for the end-to-end assignment check.
    const email = `ci-roleguard+${stamp}-${rand}@example.invalid`;
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password: `Pw!${rand}${stamp}${rand}`,
      email_confirm: true,
    });
    if (createErr || !created?.user) throw createErr ?? new Error("auth user creation failed");

    const { error: memberErr } = await service.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: created.user.id,
      role: "staff",
      is_approved: true,
      display_name: "CI RoleGuard Staff",
    });
    if (memberErr) throw memberErr;

    seeded = {
      tenantId,
      otherTenantId,
      safeKey,
      boundaryKey,
      staffUserId: created.user.id,
      otherTenantKey,
    };
  }, 90_000);

  afterAll(async () => {
    if (!seeded) return;
    await service.from("tenant_users").delete().eq("tenant_id", seeded.tenantId);
    await service
      .from("role_definitions")
      .delete()
      .in("tenant_id", [seeded.tenantId, seeded.otherTenantId]);
    await service
      .from("tenants")
      .delete()
      .in("id", [seeded.tenantId, seeded.otherTenantId]);
    await service.auth.admin.deleteUser(seeded.staffUserId).catch(() => {});
  }, 90_000);

  // ---------- write-time trigger ----------

  it("rejects a custom role definition at hierarchy_level 0 (owner level)", async () => {
    if (!seeded) throw new Error("seed missing");
    const { error } = await service.from("role_definitions").insert({
      tenant_id: seeded.tenantId,
      role_key: `ci_owner_clone_${stamp}`,
      display_name: "CI Owner Clone",
      hierarchy_level: 0,
      is_system: false,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/hierarchy_level/i);
  });

  it("rejects a custom role definition at hierarchy_level 9 (just above admin)", async () => {
    if (!seeded) throw new Error("seed missing");
    const { error } = await service.from("role_definitions").insert({
      tenant_id: seeded.tenantId,
      role_key: `ci_nine_${stamp}`,
      display_name: "CI Nine",
      hierarchy_level: 9,
      is_system: false,
    });
    expect(error).not.toBeNull();
  });

  it("rejects a negative hierarchy_level (superadmin level)", async () => {
    if (!seeded) throw new Error("seed missing");
    const { error } = await service.from("role_definitions").insert({
      tenant_id: seeded.tenantId,
      role_key: `ci_super_clone_${stamp}`,
      display_name: "CI Super Clone",
      hierarchy_level: -10,
      is_system: false,
    });
    expect(error).not.toBeNull();
  });

  for (const reserved of ["owner", "superadmin", "admin"]) {
    it(`rejects the reserved role_key "${reserved}" for a non-system definition`, async () => {
      if (!seeded) throw new Error("seed missing");
      const { error } = await service.from("role_definitions").insert({
        tenant_id: seeded.otherTenantId,
        role_key: reserved,
        display_name: `CI Rogue ${reserved}`,
        hierarchy_level: 50,
        is_system: false,
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toMatch(/reserved|duplicate|unique/i);
    });
  }

  it("accepts a custom role definition at hierarchy_level 10 and above", async () => {
    if (!seeded) throw new Error("seed missing");
    const key = `ci_accepted_${stamp}`;
    const { error } = await service.from("role_definitions").insert({
      tenant_id: seeded.tenantId,
      role_key: key,
      display_name: "CI Accepted",
      hierarchy_level: 30,
      is_system: false,
    });
    expect(error).toBeNull();
    await service
      .from("role_definitions")
      .delete()
      .eq("tenant_id", seeded.tenantId)
      .eq("role_key", key);
  });

  it("blocks escalating an existing custom role definition via UPDATE", async () => {
    if (!seeded) throw new Error("seed missing");
    const { error } = await service
      .from("role_definitions")
      .update({ hierarchy_level: 0 })
      .eq("tenant_id", seeded.tenantId)
      .eq("role_key", seeded.safeKey);
    expect(error).not.toBeNull();

    const { data: after } = await service
      .from("role_definitions")
      .select("hierarchy_level")
      .eq("tenant_id", seeded.tenantId)
      .eq("role_key", seeded.safeKey)
      .single();
    expect(after?.hierarchy_level).toBe(20);
  });

  it("blocks renaming an existing custom role definition onto a reserved key", async () => {
    if (!seeded) throw new Error("seed missing");
    const { error } = await service
      .from("role_definitions")
      .update({ role_key: "owner" })
      .eq("tenant_id", seeded.tenantId)
      .eq("role_key", seeded.safeKey);
    expect(error).not.toBeNull();
  });

  it("leaves the seeded system role definitions untouched", async () => {
    if (!seeded) throw new Error("seed missing");
    const { data, error } = await service
      .from("role_definitions")
      .select("role_key, hierarchy_level, is_system")
      .eq("tenant_id", seeded.tenantId)
      .eq("is_system", true)
      .order("hierarchy_level");
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.map((r) => r.role_key)).toContain("owner");
    // System rows are exempt from the >= 10 rule by design.
    expect(rows.some((r) => (r.hierarchy_level as number) < 10)).toBe(true);
  });

  // ---------- read-time assignability ----------

  it("assignability accepts NULL", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(await assignable(service, seeded.tenantId, null)).toBe(true);
  });

  it("assignability accepts a level-20 and a boundary level-10 custom key", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(await assignable(service, seeded.tenantId, seeded.safeKey)).toBe(true);
    expect(await assignable(service, seeded.tenantId, seeded.boundaryKey)).toBe(true);
  });

  it("assignability rejects the reserved owner and superadmin keys", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(await assignable(service, seeded.tenantId, "owner")).toBe(false);
    expect(await assignable(service, seeded.tenantId, "superadmin")).toBe(false);
  });

  it("assignability rejects an unknown key", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(await assignable(service, seeded.tenantId, `ci_nope_${stamp}`)).toBe(false);
  });

  it("assignability rejects a key that only exists on another tenant", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(await assignable(service, seeded.tenantId, seeded.otherTenantKey)).toBe(false);
    expect(await assignable(service, seeded.otherTenantId, seeded.otherTenantKey)).toBe(true);
  });

  // ---------- end-to-end effect on tenant_users ----------

  it("a safe custom_role_key can be attached to a staff membership", async () => {
    if (!seeded) throw new Error("seed missing");
    const { error } = await service
      .from("tenant_users")
      .update({ custom_role_key: seeded.safeKey })
      .eq("tenant_id", seeded.tenantId)
      .eq("user_id", seeded.staffUserId);
    expect(error).toBeNull();

    const { data } = await service
      .from("tenant_users")
      .select("custom_role_key, role")
      .eq("tenant_id", seeded.tenantId)
      .eq("user_id", seeded.staffUserId)
      .single();
    expect(data?.custom_role_key).toBe(seeded.safeKey);
    expect(data?.role).toBe("staff");
  });

  it("a staff membership carrying a custom role does not gain owner permissions", async () => {
    if (!seeded) throw new Error("seed missing");
    // The custom role has no role_permissions rows, so has_permission must
    // stay false for an owner-grade permission.
    const { data, error } = await service.rpc("has_permission", {
      p_user_id: seeded.staffUserId,
      p_permission: "settings.manage",
      p_tenant_id: seeded.tenantId,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("has_permission stays tenant-scoped for the custom role", async () => {
    if (!seeded) throw new Error("seed missing");
    const { data, error } = await service.rpc("has_permission", {
      p_user_id: seeded.staffUserId,
      p_permission: "settings.manage",
      p_tenant_id: seeded.otherTenantId,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});

describe.skipIf(canRun)(
  "custom role definition hierarchy guard (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
