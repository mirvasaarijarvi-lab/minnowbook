/**
 * Cross-tenant isolation regression for `resource_images`.
 *
 * A signed-in user who is a member of Tenant B, and an anonymous user,
 * must not be able to reach Tenant A's private images (parent resource
 * not active+approved) through ANY read path:
 *   - by primary key (`id`)
 *   - by exact `image_url`
 *   - via any listing endpoint (bulk select scoped to Tenant A, or
 *     unscoped select that would fan out across tenants)
 *
 * For Tenant A's public images (parent active+approved) the same two
 * callers can only reach the row through the public policy — being a
 * member of a *different* tenant grants no elevated access to Tenant A.
 * A control assertion confirms the public row IS visible to both,
 * proving the seed is exercised rather than silently empty.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to seed + create the auth user.
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

interface TenantASeed {
  tenantId: string;
  publicResourceId: string;
  publicImageId: string;
  publicImageUrl: string;
  privateResourceId: string;
  privateImageId: string;
  privateImageUrl: string;
}

interface TenantBSeed {
  tenantId: string;
  userId: string;
  email: string;
  password: string;
}

interface Seeded {
  a: TenantASeed;
  b: TenantBSeed;
}

describe.runIf(canRun)(
  "resource_images: images owned by Tenant A are not reachable by Tenant B members or anon",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;
    let tenantBMember: SupabaseClient | null = null;

    beforeAll(async () => {
      service = newService();
      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      // ---- Tenant A: owns the images under test ------------------------
      const { data: tA, error: tAErr } = await service
        .from("tenants")
        .insert({
          name: `CI XT-A ${stamp}`,
          slug: `ci-resimg-xt2-a-${stamp}-${rand}`,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tAErr || !tA) throw tAErr ?? new Error("tenant A insert failed");
      const tenantAId = tA.id as string;

      async function seedResourceWithImage(
        label: string,
        is_active: boolean,
        approval_status: "approved" | "pending",
      ): Promise<{ resourceId: string; imageId: string; imageUrl: string }> {
        const { data: res, error: rErr } = await service
          .from("resources")
          .insert({
            tenant_id: tenantAId,
            name: `CI XT-A ${label} ${stamp}`,
            resource_type: "table",
            is_active,
            approval_status,
          })
          .select("id")
          .single();
        if (rErr || !res) throw rErr ?? new Error(`resource insert failed for ${label}`);
        const imageUrl = `https://example.invalid/xt2-a-${label}-${stamp}-${rand}.jpg`;
        const { data: img, error: iErr } = await service
          .from("resource_images")
          .insert({
            tenant_id: tenantAId,
            resource_id: res.id,
            image_url: imageUrl,
            sort_order: 0,
          })
          .select("id")
          .single();
        if (iErr || !img) throw iErr ?? new Error(`image insert failed for ${label}`);
        return { resourceId: res.id as string, imageId: img.id as string, imageUrl };
      }

      const pub = await seedResourceWithImage("public", true, "approved");
      const priv = await seedResourceWithImage("private", false, "approved");

      // ---- Tenant B: unrelated tenant with a real signed-in member -----
      const { data: tB, error: tBErr } = await service
        .from("tenants")
        .insert({
          name: `CI XT-B ${stamp}`,
          slug: `ci-resimg-xt2-b-${stamp}-${rand}`,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tBErr || !tB) throw tBErr ?? new Error("tenant B insert failed");
      const tenantBId = tB.id as string;

      const email = `ci-resimg-xt2-b+${stamp}-${rand}@example.invalid`;
      const password = `Pw!${rand}${stamp}${rand}`;
      const { data: created, error: createErr } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !created?.user) throw createErr ?? new Error("auth user create failed");

      const { error: tuErr } = await service
        .from("tenant_users")
        .insert({
          tenant_id: tenantBId,
          user_id: created.user.id,
          role: "staff",
          is_approved: true,
        });
      if (tuErr) throw tuErr;

      tenantBMember = newAnon();
      const { error: signInErr } = await tenantBMember.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) throw signInErr;

      seeded = {
        a: {
          tenantId: tenantAId,
          publicResourceId: pub.resourceId,
          publicImageId: pub.imageId,
          publicImageUrl: pub.imageUrl,
          privateResourceId: priv.resourceId,
          privateImageId: priv.imageId,
          privateImageUrl: priv.imageUrl,
        },
        b: { tenantId: tenantBId, userId: created.user.id, email, password },
      };
    }, 60_000);

    afterAll(async () => {
      if (tenantBMember) await tenantBMember.auth.signOut().catch(() => {});
      if (!seeded) return;
      await service
        .from("resource_images")
        .delete()
        .in("id", [seeded.a.publicImageId, seeded.a.privateImageId]);
      await service
        .from("resources")
        .delete()
        .in("id", [seeded.a.publicResourceId, seeded.a.privateResourceId]);
      await service.from("tenant_users").delete().eq("user_id", seeded.b.userId);
      await service.from("tenants").delete().in("id", [seeded.a.tenantId, seeded.b.tenantId]);
      await service.auth.admin.deleteUser(seeded.b.userId).catch(() => {});
    }, 60_000);

    // -----------------------------------------------------------------
    // Sanity control: the seed is exercised. Both callers CAN see the
    // public image via the public policy — proving a later "no rows"
    // assertion is a real deny, not an empty seed.
    // -----------------------------------------------------------------
    it("control: anon can see Tenant A's public image (parent active+approved)", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .eq("id", seeded.a.publicImageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(seeded.a.publicImageId);
    });

    it("control: Tenant B member can see Tenant A's public image via the public policy", async () => {
      if (!seeded || !tenantBMember) throw new Error("seed missing");
      const { data, error } = await tenantBMember
        .from("resource_images")
        .select("id")
        .eq("id", seeded.a.publicImageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(seeded.a.publicImageId);
    });

    // -----------------------------------------------------------------
    // Anonymous caller cannot reach Tenant A's private image by any read
    // path.
    // -----------------------------------------------------------------
    it("anon cannot fetch the private image by id", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon
        .from("resource_images")
        .select("id, image_url")
        .eq("id", seeded.a.privateImageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("anon cannot fetch the private image by exact image_url", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .eq("image_url", seeded.a.privateImageUrl)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("anon bulk select scoped to Tenant A does not disclose the private image", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .eq("tenant_id", seeded.a.tenantId);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.a.publicImageId].sort());
      expect(ids).not.toContain(seeded.a.privateImageId);
    });

    it("anon unscoped select over the seeded pair leaks only the public image", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .in("id", [seeded.a.publicImageId, seeded.a.privateImageId]);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.a.publicImageId].sort());
      expect(ids).not.toContain(seeded.a.privateImageId);
    });

    // -----------------------------------------------------------------
    // Tenant B member (signed-in, member of an unrelated tenant) has no
    // elevated access to Tenant A. Same denials as anon on every path.
    // -----------------------------------------------------------------
    it("Tenant B member cannot fetch Tenant A's private image by id", async () => {
      if (!seeded || !tenantBMember) throw new Error("seed missing");
      const { data, error } = await tenantBMember
        .from("resource_images")
        .select("id")
        .eq("id", seeded.a.privateImageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("Tenant B member cannot fetch Tenant A's private image by exact image_url", async () => {
      if (!seeded || !tenantBMember) throw new Error("seed missing");
      const { data, error } = await tenantBMember
        .from("resource_images")
        .select("id")
        .eq("image_url", seeded.a.privateImageUrl)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("Tenant B member's bulk select scoped to Tenant A does not disclose the private image", async () => {
      if (!seeded || !tenantBMember) throw new Error("seed missing");
      const { data, error } = await tenantBMember
        .from("resource_images")
        .select("id")
        .eq("tenant_id", seeded.a.tenantId);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.a.publicImageId].sort());
      expect(ids).not.toContain(seeded.a.privateImageId);
    });

    it("Tenant B member's unscoped select over the seeded pair leaks only the public image", async () => {
      if (!seeded || !tenantBMember) throw new Error("seed missing");
      const { data, error } = await tenantBMember
        .from("resource_images")
        .select("id")
        .in("id", [seeded.a.publicImageId, seeded.a.privateImageId]);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.a.publicImageId].sort());
      expect(ids).not.toContain(seeded.a.privateImageId);
    });

    it("Tenant B member scoping by their OWN tenant_id sees no Tenant A rows", async () => {
      if (!seeded || !tenantBMember) throw new Error("seed missing");
      const { data, error } = await tenantBMember
        .from("resource_images")
        .select("id, tenant_id")
        .eq("tenant_id", seeded.b.tenantId);
      expect(error).toBeNull();
      for (const row of data ?? []) {
        expect(row.tenant_id).toBe(seeded.b.tenantId);
      }
      const ids = (data ?? []).map((r) => r.id);
      expect(ids).not.toContain(seeded.a.publicImageId);
      expect(ids).not.toContain(seeded.a.privateImageId);
    });
  },
);

describe.skipIf(canRun)(
  "resource_images cross-tenant isolation (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
