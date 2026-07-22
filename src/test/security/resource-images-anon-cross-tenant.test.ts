/**
 * RLS + client-scoping regression: when an anonymous client scopes a
 * `resource_images` SELECT to a specific `tenant_id`, it must receive
 * ONLY that tenant's images — never leak rows from a sibling tenant,
 * even though both tenants' images are individually public (parent
 * resource `is_active = true` AND `approval_status = 'approved'`).
 *
 * Rationale: `Public can view resource images` intentionally allows
 * cross-tenant discovery of public images, but every consumer surface
 * (public booking flow, subdomain landing pages) filters by `tenant_id`.
 * This test locks in that whenever the filter IS applied, the DB honours
 * it strictly and no other-tenant image can slip through — a regression
 * here would silently expose one tenant's imagery on another tenant's
 * public page.
 *
 * Seeds two independent tenants, each with a single active + approved
 * resource + image. Then, as anon:
 *   1. Query with `.eq('tenant_id', tenantA)` — must return exactly A's
 *      image and never B's.
 *   2. Query with `.eq('tenant_id', tenantB)` — must return exactly B's
 *      image and never A's.
 *   3. Query with `.in('id', [aImg, bImg]).eq('tenant_id', tenantA)` —
 *      even when the caller enumerates the sibling image's ID directly,
 *      the tenant filter must strip it.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to seed. Missing creds skip cleanly.
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

const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

interface SeededTenant {
  tenantId: string;
  resourceId: string;
  imageId: string;
  imageUrl: string;
}

interface Seeded {
  a: SeededTenant;
  b: SeededTenant;
}

describe.runIf(canRun)("resource_images anon SELECT cannot leak across tenants when scoped by tenant_id", () => {
  let service: SupabaseClient;
  let seeded: Seeded | null = null;

  async function seedTenant(label: string): Promise<SeededTenant> {
    const stamp = Date.now();
    const suffix = `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
    const slug = `ci-resimg-xt-${label}-${suffix}`;

    const { data: tenant, error: tErr } = await service
      .from("tenants")
      .insert({
        name: `CI Cross-Tenant ${label} ${stamp}`,
        slug,
        tier: "basic",
        subscription_status: "trialing",
        is_active: true,
      })
      .select("id")
      .single();
    if (tErr || !tenant) throw tErr ?? new Error(`tenant insert failed for ${label}`);

    const { data: res, error: rErr } = await service
      .from("resources")
      .insert({
        tenant_id: tenant.id,
        name: `CI XT ${label} ${stamp}`,
        resource_type: "table",
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    if (rErr || !res) throw rErr ?? new Error(`resource insert failed for ${label}`);

    const imageUrl = `https://example.invalid/xt-${label}-${suffix}.jpg`;
    const { data: img, error: iErr } = await service
      .from("resource_images")
      .insert({
        tenant_id: tenant.id,
        resource_id: res.id,
        image_url: imageUrl,
        sort_order: 0,
      })
      .select("id")
      .single();
    if (iErr || !img) throw iErr ?? new Error(`image insert failed for ${label}`);

    return {
      tenantId: tenant.id as string,
      resourceId: res.id as string,
      imageId: img.id as string,
      imageUrl,
    };
  }

  beforeAll(async () => {
    service = newService();
    // Seed sequentially to keep any slug-collision fallout deterministic.
    const a = await seedTenant("a");
    const b = await seedTenant("b");
    seeded = { a, b };
  }, 60_000);

  afterAll(async () => {
    if (!seeded) return;
    const imageIds = [seeded.a.imageId, seeded.b.imageId];
    const resourceIds = [seeded.a.resourceId, seeded.b.resourceId];
    const tenantIds = [seeded.a.tenantId, seeded.b.tenantId];
    await service.from("resource_images").delete().in("id", imageIds);
    await service.from("resources").delete().in("id", resourceIds);
    await service.from("tenants").delete().in("id", tenantIds);
  }, 60_000);

  it("scoping by tenant A returns only tenant A's image", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, tenant_id")
      .eq("tenant_id", seeded.a.tenantId);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id).sort();
    expect(ids).toEqual([seeded.a.imageId]);
    expect(ids).not.toContain(seeded.b.imageId);
    for (const row of data ?? []) {
      expect(row.tenant_id).toBe(seeded.a.tenantId);
    }
  });

  it("scoping by tenant B returns only tenant B's image", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, tenant_id")
      .eq("tenant_id", seeded.b.tenantId);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id).sort();
    expect(ids).toEqual([seeded.b.imageId]);
    expect(ids).not.toContain(seeded.a.imageId);
    for (const row of data ?? []) {
      expect(row.tenant_id).toBe(seeded.b.tenantId);
    }
  });

  it("even when the caller enumerates the other tenant's image id, the tenant_id filter strips it", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, tenant_id")
      .in("id", [seeded.a.imageId, seeded.b.imageId])
      .eq("tenant_id", seeded.a.tenantId);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id).sort();
    expect(ids).toEqual([seeded.a.imageId]);
    expect(ids).not.toContain(seeded.b.imageId);
  });

  it("fetching tenant B's image by id while scoped to tenant A returns no row", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("id", seeded.b.imageId)
      .eq("tenant_id", seeded.a.tenantId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe.skipIf(canRun)("resource_images anon cross-tenant scoping (skipped: missing live creds)", () => {
  it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(true).toBe(true);
  });
});
