/**
 * Live DB regression: `public.is_custom_role_key_assignable_by_owner`
 * must reject any custom_role_key that resolves to `owner`, `superadmin`,
 * or a role_definitions row with `hierarchy_level < 10`, and must accept
 * NULL or a role_definitions row with `hierarchy_level >= 10`.
 *
 * Complements the pure-port unit tests in
 * `custom-role-key-assignment.test.ts` by exercising the actual SQL
 * function so a future migration cannot silently loosen the check.
 *
 * Seeds a disposable tenant + role_definitions rows via the service role,
 * calls the SECURITY DEFINER function through PostgREST `rpc(...)`, then
 * tears the tenant down. Skips cleanly when live creds are missing.
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
  roleIds: string[];
}

async function callAssignable(
  service: SupabaseClient,
  tenantId: string,
  key: string | null,
): Promise<boolean> {
  const { data, error } = await service.rpc(
    "is_custom_role_key_assignable_by_owner",
    { _tenant_id: tenantId, _custom_role_key: key },
  );
  if (error) throw error;
  return data as boolean;
}

describe.runIf(canRun)("is_custom_role_key_assignable_by_owner (live DB)", () => {
  let service: SupabaseClient;
  let seeded: Seeded | null = null;

  beforeAll(async () => {
    service = newService();
    const stamp = Date.now();
    const slug = `ci-crk-${stamp}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: tenant, error: tenantErr } = await service
      .from("tenants")
      .insert({
        name: `CI CustomRoleKey ${stamp}`,
        slug,
        tier: "basic",
        subscription_status: "trialing",
        is_active: true,
      })
      .select("id")
      .single();
    if (tenantErr || !tenant) throw tenantErr ?? new Error("tenant insert returned no row");
    const tenantId = tenant.id as string;

    // The tenant may auto-seed system roles via trigger. We only need to
    // add a couple of non-system role_definitions rows to cover the
    // hierarchy boundary: one safe (>=10), one privileged (<10). We also
    // insert rogue rows with the reserved keys 'owner' / 'superadmin' at
    // hierarchy_level >= 10 to prove the function rejects them by NAME,
    // not just by level.
    const seeds = [
      { role_key: `ci_safe_${stamp}`, hierarchy_level: 15, display_name: "CI Safe" },
      { role_key: `ci_admin_boundary_${stamp}`, hierarchy_level: 10, display_name: "CI Boundary 10" },
      { role_key: `ci_elevated_${stamp}`, hierarchy_level: 5, display_name: "CI Elevated 5" },
      { role_key: `ci_just_below_${stamp}`, hierarchy_level: 9, display_name: "CI Just Below 9" },
      // Deliberately reuse reserved keys with a safe level: function must
      // still refuse them because of the explicit NOT IN filter.
      { role_key: "owner", hierarchy_level: 50, display_name: "CI Rogue Owner" },
      { role_key: "superadmin", hierarchy_level: 50, display_name: "CI Rogue Superadmin" },
    ];

    const roleIds: string[] = [];
    for (const s of seeds) {
      const { data, error } = await service
        .from("role_definitions")
        .insert({
          tenant_id: tenantId,
          role_key: s.role_key,
          display_name: s.display_name,
          hierarchy_level: s.hierarchy_level,
          is_system: false,
        })
        .select("id")
        .maybeSingle();
      // The rogue owner/superadmin inserts may hit a unique constraint if
      // the tenant auto-seeds system rows. That's fine: the point of this
      // test is that the function refuses those keys, and the auto-seeded
      // rows already exist for us to target. Only rethrow when a
      // non-system seed we control fails.
      if (error && !s.role_key.startsWith("ci_")) continue;
      if (error) throw error;
      if (data?.id) roleIds.push(data.id as string);
    }

    seeded = { tenantId, roleIds };
  }, 60_000);

  afterAll(async () => {
    if (!seeded) return;
    if (seeded.roleIds.length) {
      await service.from("role_definitions").delete().in("id", seeded.roleIds);
    }
    await service.from("tenants").delete().eq("id", seeded.tenantId);
  }, 60_000);

  it("accepts NULL custom_role_key", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(await callAssignable(service, seeded.tenantId, null)).toBe(true);
  });

  it("accepts a custom role_key with hierarchy_level > 10", async () => {
    if (!seeded) throw new Error("seed missing");
    const key = (
      await service
        .from("role_definitions")
        .select("role_key")
        .eq("tenant_id", seeded.tenantId)
        .eq("hierarchy_level", 15)
        .maybeSingle()
    ).data?.role_key as string;
    expect(key).toBeTruthy();
    expect(await callAssignable(service, seeded.tenantId, key)).toBe(true);
  });

  it("accepts a custom role_key sitting exactly on the boundary (hierarchy_level = 10)", async () => {
    if (!seeded) throw new Error("seed missing");
    const key = (
      await service
        .from("role_definitions")
        .select("role_key")
        .eq("tenant_id", seeded.tenantId)
        .eq("hierarchy_level", 10)
        .like("role_key", "ci_admin_boundary_%")
        .maybeSingle()
    ).data?.role_key as string;
    expect(key).toBeTruthy();
    expect(await callAssignable(service, seeded.tenantId, key)).toBe(true);
  });

  it("rejects the reserved 'owner' key even when a role_definitions row exists at a safe level", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(await callAssignable(service, seeded.tenantId, "owner")).toBe(false);
  });

  it("rejects the reserved 'superadmin' key even when a role_definitions row exists at a safe level", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(await callAssignable(service, seeded.tenantId, "superadmin")).toBe(false);
  });

  it("rejects a custom role_key with hierarchy_level = 5 (elevated below admin)", async () => {
    if (!seeded) throw new Error("seed missing");
    const key = (
      await service
        .from("role_definitions")
        .select("role_key")
        .eq("tenant_id", seeded.tenantId)
        .eq("hierarchy_level", 5)
        .maybeSingle()
    ).data?.role_key as string;
    expect(key).toBeTruthy();
    expect(await callAssignable(service, seeded.tenantId, key)).toBe(false);
  });

  it("rejects a custom role_key with hierarchy_level = 9 (just below the admin boundary)", async () => {
    if (!seeded) throw new Error("seed missing");
    const key = (
      await service
        .from("role_definitions")
        .select("role_key")
        .eq("tenant_id", seeded.tenantId)
        .eq("hierarchy_level", 9)
        .maybeSingle()
    ).data?.role_key as string;
    expect(key).toBeTruthy();
    expect(await callAssignable(service, seeded.tenantId, key)).toBe(false);
  });

  it("rejects a custom role_key that does not exist for the tenant", async () => {
    if (!seeded) throw new Error("seed missing");
    expect(
      await callAssignable(service, seeded.tenantId, `ci_not_a_real_role_${Date.now()}`),
    ).toBe(false);
  });

  it("rejects a role_key that only exists on a DIFFERENT tenant", async () => {
    if (!seeded) throw new Error("seed missing");
    const stamp = Date.now();
    const slug = `ci-crk-other-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
    const { data: other, error: otherErr } = await service
      .from("tenants")
      .insert({
        name: `CI CRK Other ${stamp}`,
        slug,
        tier: "basic",
        subscription_status: "trialing",
        is_active: true,
      })
      .select("id")
      .single();
    if (otherErr || !other) throw otherErr ?? new Error("other tenant insert failed");
    const otherId = other.id as string;

    const key = `ci_other_tenant_role_${stamp}`;
    const { data: role, error: roleErr } = await service
      .from("role_definitions")
      .insert({
        tenant_id: otherId,
        role_key: key,
        display_name: "CI Other Tenant Role",
        hierarchy_level: 20,
        is_system: false,
      })
      .select("id")
      .single();
    if (roleErr || !role) throw roleErr ?? new Error("other role insert failed");

    try {
      // The role exists, but under a different tenant — must be rejected
      // for our tenant.
      expect(await callAssignable(service, seeded.tenantId, key)).toBe(false);
      // Sanity: it IS assignable within its own tenant.
      expect(await callAssignable(service, otherId, key)).toBe(true);
    } finally {
      await service.from("role_definitions").delete().eq("id", role.id as string);
      await service.from("tenants").delete().eq("id", otherId);
    }
  });
});

describe.skipIf(canRun)("is_custom_role_key_assignable_by_owner (skipped: missing live creds)", () => {
  it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(true).toBe(true);
  });
});
