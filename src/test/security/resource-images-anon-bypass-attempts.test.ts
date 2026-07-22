/**
 * Bypass-attempt regression: no row-level attribute of `resource_images`
 * can override the parent-resource gating enforced by the anon SELECT
 * policy.
 *
 * The anon policy on `public.resource_images` only permits rows whose
 * parent `resources` row is `is_active = true AND approval_status =
 * 'approved'`. Today there is no per-image visibility flag; this test
 * seeds images with row-level attributes that look "as public as
 * possible" (low `sort_order`, benign `image_url`, cross-tenant
 * ambiguity) under gated parents and asserts anon still cannot read
 * them, by-id or via tenant scan.
 *
 * Complements `resource-images-schema-invariant.test.ts` (which catches
 * a new visibility column at the schema level) by proving that the
 * columns that DO exist can't be weaponised for a bypass.
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
  // Gated parents with "looks-public" row-level image attributes:
  inactiveLooksPublic: SeededImage; // parent is_active=false, approval_status=approved
  pendingLooksPublic: SeededImage; // parent is_active=true, approval_status=pending
  rejectedLooksPublic: SeededImage; // parent is_active=true, approval_status=rejected
  // Sanity: an ungated parent so we can confirm reads work at all.
  visibleControl: SeededImage; // parent is_active=true, approval_status=approved
}

describe.runIf(canRun)(
  "resource_images anon bypass-attempts: row-level attributes cannot override parent gating",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;

    beforeAll(async () => {
      service = newService();
      const stamp = Date.now();
      const slug = `ci-resimg-bypass-${stamp}-${Math.random().toString(36).slice(2, 8)}`;

      const { data: tenant, error: tenantErr } = await service
        .from("tenants")
        .insert({
          name: `CI Bypass ${stamp}`,
          slug,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tenantErr || !tenant) throw tenantErr ?? new Error("tenant insert failed");
      const tenantId = tenant.id as string;

      async function seedOne(
        label: string,
        is_active: boolean,
        approval_status: "approved" | "pending" | "rejected",
      ): Promise<SeededImage> {
        const { data: res, error: resErr } = await service
          .from("resources")
          .insert({
            tenant_id: tenantId,
            name: `CI bypass ${label} ${stamp}`,
            resource_type: "table",
            is_active,
            approval_status,
          })
          .select("id")
          .single();
        if (resErr || !res) throw resErr ?? new Error(`resource insert failed for ${label}`);

        // "Looks-public" row shape: lowest sort_order (typically the primary/
        // hero image), a benign https URL, no unusual markers.
        const imageUrl = `https://cdn.example.invalid/looks-public-${label}-${stamp}.jpg`;
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
        inactiveLooksPublic: await seedOne("inactive", false, "approved"),
        pendingLooksPublic: await seedOne("pending", true, "pending"),
        rejectedLooksPublic: await seedOne("rejected", true, "rejected"),
        visibleControl: await seedOne("visible", true, "approved"),
      };
    }, 60_000);

    afterAll(async () => {
      if (!seeded) return;
      const imageIds = [
        seeded.inactiveLooksPublic.imageId,
        seeded.pendingLooksPublic.imageId,
        seeded.rejectedLooksPublic.imageId,
        seeded.visibleControl.imageId,
      ];
      const resourceIds = [
        seeded.inactiveLooksPublic.resourceId,
        seeded.pendingLooksPublic.resourceId,
        seeded.rejectedLooksPublic.resourceId,
        seeded.visibleControl.resourceId,
      ];
      await service.from("resource_images").delete().in("id", imageIds);
      await service.from("resources").delete().in("id", resourceIds);
      await service.from("tenants").delete().eq("id", seeded.tenantId);
    }, 60_000);

    it("sanity: the visible control row IS readable by anon (guards against a broken seed)", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .eq("id", seeded.visibleControl.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(seeded.visibleControl.imageId);
    });

    it.each([
      ["inactive parent (is_active=false)", "inactiveLooksPublic"],
      ["pending parent (approval_status='pending')", "pendingLooksPublic"],
      ["rejected parent (approval_status='rejected')", "rejectedLooksPublic"],
    ] as const)(
      "row-level 'looks-public' attributes do not bypass gating: %s",
      async (_label, key) => {
        if (!seeded) throw new Error("seed missing");
        const target = seeded[key];
        const anon = newAnon();

        // By-id lookup.
        const byId = await anon
          .from("resource_images")
          .select("id, image_url, sort_order")
          .eq("id", target.imageId)
          .maybeSingle();
        expect(byId.error).toBeNull();
        expect(byId.data).toBeNull();

        // By image_url lookup (the exact URL a scraper would try).
        const byUrl = await anon
          .from("resource_images")
          .select("id")
          .eq("image_url", target.imageUrl)
          .maybeSingle();
        expect(byUrl.error).toBeNull();
        expect(byUrl.data).toBeNull();

        // Filtering by sort_order=0 must not surface the row either.
        const bySort = await anon
          .from("resource_images")
          .select("id")
          .eq("tenant_id", seeded.tenantId)
          .eq("sort_order", 0);
        expect(bySort.error).toBeNull();
        const ids = (bySort.data ?? []).map((r) => r.id);
        expect(ids).not.toContain(target.imageId);
      },
    );

    it("bulk anon scan of the seeded tenant returns only the visible control image", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .eq("tenant_id", seeded.tenantId);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.visibleControl.imageId].sort());
      expect(ids).not.toContain(seeded.inactiveLooksPublic.imageId);
      expect(ids).not.toContain(seeded.pendingLooksPublic.imageId);
      expect(ids).not.toContain(seeded.rejectedLooksPublic.imageId);
    });
  },
);

describe.skipIf(canRun)(
  "resource_images anon bypass-attempts (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
