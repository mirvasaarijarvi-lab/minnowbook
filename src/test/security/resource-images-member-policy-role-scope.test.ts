/**
 * RLS regression: the "Users can view their tenant resource images" policy
 * on `resource_images` must apply to the `authenticated` role ONLY.
 *
 * Before the fix the policy was created without a TO clause, so it landed
 * on the catch-all `public` role and was also evaluated for anonymous
 * callers. With `auth.uid()` NULL that never matched in practice, but any
 * future membership helper that treats NULL loosely would have leaked
 * hidden (inactive / unapproved) resource images to the whole internet.
 *
 * Seeds one tenant with two sibling resources:
 *   - hidden:  is_active = false + approval_status = 'pending'
 *              → NOT covered by the anon-facing public policy
 *   - visible: is_active = true  + approval_status = 'approved'
 *              → covered by the public policy
 *
 * Then asserts the three-way access matrix:
 *   - tenant member (authenticated, staff role): sees BOTH images
 *   - outsider (authenticated, no membership):   sees only `visible`
 *   - anon:                                      sees only `visible`
 *
 * Also pins that the member-read policy grants SELECT only: a staff member
 * cannot insert, update or delete image rows (that stays owner/admin).
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
  hidden: SeededImage;
  visible: SeededImage;
  memberUserId: string;
  outsiderUserId: string;
  ownerUserId: string;
}

describe.runIf(canRun)(
  "resource_images tenant-member SELECT policy is scoped to authenticated",
  () => {
    let service: SupabaseClient;
    let anon: SupabaseClient;
    let member: SupabaseClient | null = null;
    let outsider: SupabaseClient | null = null;
    let seeded: Seeded | null = null;

    beforeAll(async () => {
      service = newService();
      anon = newAnon();

      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      async function makeUser(
        prefix: string,
        signIn: boolean,
      ): Promise<{ id: string; client: SupabaseClient | null }> {
        const email = `ci-resimg-${prefix}+${stamp}-${rand}@example.invalid`;
        const password = `Pw!${rand}${stamp}${rand}`;
        const { data: created, error: createErr } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createErr || !created?.user) {
          throw createErr ?? new Error(`auth user creation failed for ${prefix}`);
        }
        if (!signIn) return { id: created.user.id, client: null };
        const client = newAnon();
        const { error: signInErr } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        return { id: created.user.id, client };
      }

      // The tenant owner is a distinct throwaway user so the staff member
      // under test never inherits owner standing via tenants.owner_user_id.
      const ownerUser = await makeUser("owner", false);
      const memberUser = await makeUser("member", true);
      const outsiderUser = await makeUser("outsider", true);
      member = memberUser.client;
      outsider = outsiderUser.client;

      const { data: tenant, error: tenantErr } = await service
        .from("tenants")
        .insert({
          name: `CI ResImg Member Scope ${stamp}`,
          slug: `ci-resimg-member-${stamp}-${rand}`,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
          owner_user_id: ownerUser.id,
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

      const hidden = await seedOne("hidden", false, "pending");
      const visible = await seedOne("visible", true, "approved");

      // Staff membership: enough for the tenant-member read policy, but not
      // for the owner/admin manage policy.
      const { error: memberErr } = await service.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: memberUser.id,
        role: "staff",
        is_approved: true,
        display_name: "CI Member",
      });
      if (memberErr) throw memberErr;

      seeded = {
        tenantId,
        hidden,
        visible,
        memberUserId: memberUser.id,
        outsiderUserId: outsiderUser.id,
        ownerUserId: ownerUser.id,
      };
    }, 90_000);

    afterAll(async () => {
      await member?.auth.signOut().catch(() => {});
      await outsider?.auth.signOut().catch(() => {});
      if (!seeded) return;
      await service
        .from("resource_images")
        .delete()
        .in("id", [seeded.hidden.imageId, seeded.visible.imageId]);
      await service
        .from("resources")
        .delete()
        .in("id", [seeded.hidden.resourceId, seeded.visible.resourceId]);
      await service.from("tenant_users").delete().eq("tenant_id", seeded.tenantId);
      await service.from("tenants").delete().eq("id", seeded.tenantId);
      await service.auth.admin.deleteUser(seeded.memberUserId).catch(() => {});
      await service.auth.admin.deleteUser(seeded.outsiderUserId).catch(() => {});
      await service.auth.admin.deleteUser(seeded.ownerUserId).catch(() => {});
    }, 90_000);

    it("a tenant member sees the hidden (inactive + pending) image", async () => {
      if (!seeded || !member) throw new Error("seed missing");
      const { data, error } = await member
        .from("resource_images")
        .select("id, image_url")
        .eq("id", seeded.hidden.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(seeded.hidden.imageId);
    });

    it("a tenant member sees both images for their tenant", async () => {
      if (!seeded || !member) throw new Error("seed missing");
      const { data, error } = await member
        .from("resource_images")
        .select("id")
        .eq("tenant_id", seeded.tenantId);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.hidden.imageId, seeded.visible.imageId].sort());
    });

    it("anon does NOT see the hidden image (member policy no longer applies to anon)", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .eq("id", seeded.hidden.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("anon sees only the active + approved image for the tenant", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .eq("tenant_id", seeded.tenantId);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id);
      expect(ids).toEqual([seeded.visible.imageId]);
    });

    it("an authenticated outsider does NOT see the hidden image", async () => {
      if (!seeded || !outsider) throw new Error("seed missing");
      const { data, error } = await outsider
        .from("resource_images")
        .select("id")
        .eq("id", seeded.hidden.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("an authenticated outsider sees only the active + approved image", async () => {
      if (!seeded || !outsider) throw new Error("seed missing");
      const { data, error } = await outsider
        .from("resource_images")
        .select("id")
        .eq("tenant_id", seeded.tenantId);
      expect(error).toBeNull();
      expect((data ?? []).map((r) => r.id)).toEqual([seeded.visible.imageId]);
    });

    it("the member read policy grants SELECT only: staff cannot insert an image", async () => {
      if (!seeded || !member) throw new Error("seed missing");
      const { data, error } = await member
        .from("resource_images")
        .insert({
          tenant_id: seeded.tenantId,
          resource_id: seeded.visible.resourceId,
          image_url: "https://example.invalid/staff-inserted.jpg",
          sort_order: 99,
        })
        .select("id");
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("staff cannot update an image row", async () => {
      if (!seeded || !member) throw new Error("seed missing");
      const { data, error } = await member
        .from("resource_images")
        .update({ image_url: "https://example.invalid/tampered.jpg" })
        .eq("id", seeded.visible.imageId)
        .select("id");
      // RLS blocks the write: either an explicit error or zero affected rows.
      if (!error) expect(data ?? []).toEqual([]);

      const { data: after } = await service
        .from("resource_images")
        .select("image_url")
        .eq("id", seeded.visible.imageId)
        .single();
      expect(after?.image_url).toBe(seeded.visible.imageUrl);
    });

    it("staff cannot delete an image row", async () => {
      if (!seeded || !member) throw new Error("seed missing");
      const { data, error } = await member
        .from("resource_images")
        .delete()
        .eq("id", seeded.hidden.imageId)
        .select("id");
      if (!error) expect(data ?? []).toEqual([]);

      const { data: stillThere } = await service
        .from("resource_images")
        .select("id")
        .eq("id", seeded.hidden.imageId)
        .maybeSingle();
      expect(stillThere?.id).toBe(seeded.hidden.imageId);
    });

    it("anon cannot write image rows at all", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await anon
        .from("resource_images")
        .insert({
          tenant_id: seeded.tenantId,
          resource_id: seeded.visible.resourceId,
          image_url: "https://example.invalid/anon-inserted.jpg",
          sort_order: 98,
        })
        .select("id");
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  },
);

describe.skipIf(canRun)(
  "resource_images tenant-member policy role scope (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
