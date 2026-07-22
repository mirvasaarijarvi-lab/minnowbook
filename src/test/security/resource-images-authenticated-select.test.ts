/**
 * RLS regression: an authenticated user who is NOT a member of the owning
 * tenant must be gated by the same public-visibility rule as anon on
 * `resource_images`. They can only read rows whose parent `resources` row
 * is BOTH `is_active = true` AND `approval_status = 'approved'`.
 *
 * Tenant members are intentionally out of scope: the
 * "Users can view their tenant resource images" policy grants them broader
 * access by design. This suite exercises the outsider path, which is what
 * the public-select fix hardened.
 *
 * Seeds four sibling resources under a fresh tenant:
 *   - active + approved (visible to the outsider auth user)
 *   - inactive + approved (hidden)
 *   - active + pending (hidden)
 *   - active + rejected (hidden)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to seed and to create an auth user.
 * Missing creds skip cleanly.
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

interface SeededImage {
  imageId: string;
  resourceId: string;
  imageUrl: string;
}

interface Seeded {
  tenantId: string;
  visible: SeededImage;
  inactive: SeededImage;
  pending: SeededImage;
  rejected: SeededImage;
  authUserId: string;
  authEmail: string;
  authPassword: string;
}

describe.runIf(canRun)(
  "resource_images authenticated (non-member) SELECT is gated by parent resource state",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;
    let authed: SupabaseClient | null = null;

    beforeAll(async () => {
      service = newService();

      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const slug = `ci-resimg-auth-${stamp}-${rand}`;

      const { data: tenant, error: tenantErr } = await service
        .from("tenants")
        .insert({
          name: `CI Resource-Images-Auth ${stamp}`,
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
        approval_status: "approved" | "pending" | "rejected",
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

      const visible = await seedOne("visible", true, "approved");
      const inactive = await seedOne("inactive", false, "approved");
      const pending = await seedOne("pending", true, "pending");
      const rejected = await seedOne("rejected", true, "rejected");

      // Create an outsider auth user (NOT linked to the seeded tenant via
      // tenant_users). This user should hit only the "Public can view
      // resource images" policy, not the tenant-member policy.
      const authEmail = `ci-resimg-outsider+${stamp}-${rand}@example.invalid`;
      const authPassword = `Pw!${rand}${stamp}${rand}`;
      const { data: created, error: createErr } = await service.auth.admin.createUser({
        email: authEmail,
        password: authPassword,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        throw createErr ?? new Error("auth user creation returned no user");
      }

      authed = newAnon();
      const { error: signInErr } = await authed.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (signInErr) throw signInErr;

      seeded = {
        tenantId,
        visible,
        inactive,
        pending,
        rejected,
        authUserId: created.user.id,
        authEmail,
        authPassword,
      };
    }, 60_000);

    afterAll(async () => {
      if (authed) {
        await authed.auth.signOut().catch(() => {});
      }
      if (!seeded) return;
      await service
        .from("resource_images")
        .delete()
        .in("id", [
          seeded.visible.imageId,
          seeded.inactive.imageId,
          seeded.pending.imageId,
          seeded.rejected.imageId,
        ]);
      await service
        .from("resources")
        .delete()
        .in("id", [
          seeded.visible.resourceId,
          seeded.inactive.resourceId,
          seeded.pending.resourceId,
          seeded.rejected.resourceId,
        ]);
      await service.from("tenants").delete().eq("id", seeded.tenantId);
      await service.auth.admin.deleteUser(seeded.authUserId).catch(() => {});
    }, 60_000);

    it("returns the image for an active + approved parent resource", async () => {
      if (!seeded || !authed) throw new Error("seed missing");
      const { data, error } = await authed
        .from("resource_images")
        .select("id, resource_id, image_url")
        .eq("id", seeded.visible.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(seeded.visible.imageId);
      expect(data?.image_url).toBe(seeded.visible.imageUrl);
    });

    it("hides the image when the parent resource is inactive (approved but is_active=false)", async () => {
      if (!seeded || !authed) throw new Error("seed missing");
      const { data, error } = await authed
        .from("resource_images")
        .select("id")
        .eq("id", seeded.inactive.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("hides the image when the parent resource is pending approval", async () => {
      if (!seeded || !authed) throw new Error("seed missing");
      const { data, error } = await authed
        .from("resource_images")
        .select("id")
        .eq("id", seeded.pending.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("hides the image when the parent resource is rejected", async () => {
      if (!seeded || !authed) throw new Error("seed missing");
      const { data, error } = await authed
        .from("resource_images")
        .select("id")
        .eq("id", seeded.rejected.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("a bulk SELECT scoped to the seeded tenant returns only the visible image", async () => {
      if (!seeded || !authed) throw new Error("seed missing");
      const { data, error } = await authed
        .from("resource_images")
        .select("id")
        .eq("tenant_id", seeded.tenantId);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.visible.imageId].sort());
      expect(ids).not.toContain(seeded.inactive.imageId);
      expect(ids).not.toContain(seeded.pending.imageId);
      expect(ids).not.toContain(seeded.rejected.imageId);
    });
  },
);

describe.skipIf(canRun)(
  "resource_images authenticated (non-member) SELECT gating (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
