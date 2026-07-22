/**
 * RLS regression: anon SELECT on `resource_images` must only return rows
 * whose parent `resources` row is BOTH `is_active = true` AND
 * `approval_status = 'approved'`.
 *
 * Locks in the fix from migration
 * `20260722074954_..._resource_images_unconditional_public_select` so a
 * future policy change can't silently re-widen public access to images
 * belonging to inactive or unapproved resources.
 *
 * Seeds three sibling resources under a fresh tenant:
 *   - active + approved   (image should be visible to anon)
 *   - inactive + approved (image must be hidden from anon)
 *   - active + pending    (image must be hidden from anon)
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

interface SeededImage {
  imageId: string;
  resourceId: string;
  imageUrl: string;
}

interface Seeded {
  tenantId: string;
  visible: SeededImage; // active + approved
  inactive: SeededImage; // inactive + approved
  pending: SeededImage; // active + pending
}

describe.runIf(canRun)("resource_images anon SELECT is gated by parent resource state", () => {
  let service: SupabaseClient;
  let seeded: Seeded | null = null;

  beforeAll(async () => {
    service = newService();

    const stamp = Date.now();
    const slug = `ci-resimg-${stamp}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: tenant, error: tenantErr } = await service
      .from("tenants")
      .insert({
        name: `CI Resource-Images ${stamp}`,
        slug,
        tier: "basic",
        subscription_status: "trialing",
        is_active: true,
      })
      .select("id")
      .single();
    if (tenantErr || !tenant) throw tenantErr ?? new Error("tenant insert returned no row");
    const tenantId = tenant.id as string;

    async function seedOne(
      label: string,
      is_active: boolean,
      approval_status: "approved" | "pending",
    ): Promise<SeededImage> {
      const { data: res, error: resErr } = await service
        .from("resources")
        .insert({
          tenant_id: tenantId,
          name: `CI ${label} ${stamp}`,
          resource_type: "table",
          is_active,
          approval_status,
        })
        .select("id")
        .single();
      if (resErr || !res) throw resErr ?? new Error(`resource insert failed for ${label}`);

      const imageUrl = `https://example.invalid/${label}-${stamp}.jpg`;
      const { data: img, error: imgErr } = await service
        .from("resource_images")
        .insert({
          tenant_id: tenantId,
          resource_id: res.id,
          image_url: imageUrl,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (imgErr || !img) throw imgErr ?? new Error(`image insert failed for ${label}`);

      return { imageId: img.id as string, resourceId: res.id as string, imageUrl };
    }

    seeded = {
      tenantId,
      visible: await seedOne("visible", true, "approved"),
      inactive: await seedOne("inactive", false, "approved"),
      pending: await seedOne("pending", true, "pending"),
    };
  }, 60_000);

  afterAll(async () => {
    if (!seeded) return;
    // Delete images first to satisfy FK, then resources, then tenant.
    await service
      .from("resource_images")
      .delete()
      .in("id", [seeded.visible.imageId, seeded.inactive.imageId, seeded.pending.imageId]);
    await service
      .from("resources")
      .delete()
      .in("id", [seeded.visible.resourceId, seeded.inactive.resourceId, seeded.pending.resourceId]);
    await service.from("tenants").delete().eq("id", seeded.tenantId);
  }, 60_000);

  it("returns the image for an active + approved parent resource", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, resource_id, image_url")
      .eq("id", seeded.visible.imageId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(seeded.visible.imageId);
    expect(data?.image_url).toBe(seeded.visible.imageUrl);
  });

  it("hides the image when the parent resource is inactive (approved but is_active=false)", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("id", seeded.inactive.imageId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("hides the image when the parent resource is not yet approved (approval_status='pending')", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("id", seeded.pending.imageId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("a bulk anon SELECT scoped to the seeded tenant returns only the visible image", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("tenant_id", seeded.tenantId);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id).sort();
    expect(ids).toEqual([seeded.visible.imageId].sort());
    // Explicit belt-and-braces: forbidden IDs must not appear.
    expect(ids).not.toContain(seeded.inactive.imageId);
    expect(ids).not.toContain(seeded.pending.imageId);
  });
});

// When SUPABASE_SERVICE_ROLE_KEY isn't present (local dev without service
// role, PR runs without live creds), leave a breadcrumb so CI logs make
// the skip reason obvious rather than silently dropping the file.
describe.skipIf(canRun)("resource_images anon SELECT gating (skipped: missing live creds)", () => {
  it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(true).toBe(true);
  });
});
