/**
 * RLS transition regression: flipping a parent resource from
 * active + approved to a gated state (inactive or pending) must
 * immediately remove anon SELECT access to its images. There is no
 * caching layer between anon and PostgREST for this policy, so the
 * next request MUST reflect the new parent state.
 *
 * Flow per case:
 *   1. Seed active + approved parent + image, confirm anon can read it.
 *   2. Service-role updates the parent to the gated state.
 *   3. A fresh anon client (new connection, no cached session) must no
 *      longer see the image, by-id or via bulk scan.
 *   4. Flip back to active + approved; anon access must return.
 *
 * Each case gets its own resource+image pair so state transitions are
 * isolated from each other.
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

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

interface Pair {
  resourceId: string;
  imageId: string;
  imageUrl: string;
}

interface Seeded {
  tenantId: string;
  inactive: Pair; // exercised via is_active flip
  pending: Pair; // exercised via approval_status flip
}

async function anonReadById(id: string): Promise<{ found: boolean; error: unknown }> {
  const anon = newAnon();
  const { data, error } = await anon
    .from("resource_images")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return { found: data?.id === id, error };
}

async function anonScanTenant(
  tenantId: string,
): Promise<{ ids: string[]; error: unknown }> {
  const anon = newAnon();
  const { data, error } = await anon
    .from("resource_images")
    .select("id")
    .eq("tenant_id", tenantId);
  return { ids: (data ?? []).map((r) => r.id as string), error };
}

describe.runIf(canRun)(
  "resource_images anon SELECT reacts immediately to parent-resource state changes",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;

    beforeAll(async () => {
      service = newService();

      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const slug = `ci-resimg-transition-${stamp}-${rand}`;

      const { data: tenant, error: tenantErr } = await service
        .from("tenants")
        .insert({
          name: `CI Resource-Images-Transition ${stamp}`,
          slug,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tenantErr || !tenant) throw tenantErr ?? new Error("tenant insert returned no row");
      const tenantId = tenant.id as string;

      async function seedPair(label: string): Promise<Pair> {
        const { data: res, error: resErr } = await service
          .from("resources")
          .insert({
            tenant_id: tenantId,
            name: `CI ${label} ${stamp}`,
            resource_type: "table",
            is_active: true,
            approval_status: "approved",
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

        return { resourceId: res.id as string, imageId: img.id as string, imageUrl };
      }

      seeded = {
        tenantId,
        inactive: await seedPair("transition-inactive"),
        pending: await seedPair("transition-pending"),
      };
    }, 60_000);

    afterAll(async () => {
      if (!seeded) return;
      await service
        .from("resource_images")
        .delete()
        .in("id", [seeded.inactive.imageId, seeded.pending.imageId]);
      await service
        .from("resources")
        .delete()
        .in("id", [seeded.inactive.resourceId, seeded.pending.resourceId]);
      await service.from("tenants").delete().eq("id", seeded.tenantId);
    }, 60_000);

    it("active+approved -> is_active=false: anon access is lost immediately, restored on revert", async () => {
      if (!seeded) throw new Error("seed missing");
      const { imageId, resourceId } = seeded.inactive;

      // 1. Baseline: image is visible while parent is active + approved.
      const before = await anonReadById(imageId);
      expect(before.error).toBeNull();
      expect(before.found).toBe(true);

      // 2. Flip parent to inactive via service role.
      const { error: flipErr } = await service
        .from("resources")
        .update({ is_active: false })
        .eq("id", resourceId);
      expect(flipErr).toBeNull();

      // 3. Fresh anon client must no longer see it, by id or via scan.
      const afterById = await anonReadById(imageId);
      expect(afterById.error).toBeNull();
      expect(afterById.found).toBe(false);

      const afterScan = await anonScanTenant(seeded.tenantId);
      expect(afterScan.error).toBeNull();
      expect(afterScan.ids).not.toContain(imageId);

      // 4. Revert to active + approved: access must return.
      const { error: revertErr } = await service
        .from("resources")
        .update({ is_active: true })
        .eq("id", resourceId);
      expect(revertErr).toBeNull();

      const restored = await anonReadById(imageId);
      expect(restored.error).toBeNull();
      expect(restored.found).toBe(true);
    });

    it("active+approved -> approval_status='pending': anon access is lost immediately, restored on revert", async () => {
      if (!seeded) throw new Error("seed missing");
      const { imageId, resourceId } = seeded.pending;

      // 1. Baseline.
      const before = await anonReadById(imageId);
      expect(before.error).toBeNull();
      expect(before.found).toBe(true);

      // 2. Flip approval_status to pending.
      const { error: flipErr } = await service
        .from("resources")
        .update({ approval_status: "pending" })
        .eq("id", resourceId);
      expect(flipErr).toBeNull();

      // 3. Fresh anon client must no longer see it.
      const afterById = await anonReadById(imageId);
      expect(afterById.error).toBeNull();
      expect(afterById.found).toBe(false);

      const afterScan = await anonScanTenant(seeded.tenantId);
      expect(afterScan.error).toBeNull();
      expect(afterScan.ids).not.toContain(imageId);

      // 4. Revert to approved.
      const { error: revertErr } = await service
        .from("resources")
        .update({ approval_status: "approved" })
        .eq("id", resourceId);
      expect(revertErr).toBeNull();

      const restored = await anonReadById(imageId);
      expect(restored.error).toBeNull();
      expect(restored.found).toBe(true);
    });
  },
);

describe.skipIf(canRun)(
  "resource_images anon parent-state transition (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
