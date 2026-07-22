/**
 * Cross-tenant isolation matrix for `resource_images`.
 *
 * Extends `resource-images-cross-tenant-isolation.test.ts` to prove the
 * denial holds for signed-in members of Tenant B across every role
 * (staff and non-staff: `owner`, `admin`), because a Tenant B user's
 * *role in Tenant B* must never widen their access to Tenant A. Each
 * role is a fresh auth user + `tenant_users` row so role bleed cannot
 * mask a failure.
 *
 * For every role we assert:
 *   1. Control (within-tenant, public): the Tenant B member CAN see
 *      Tenant A's public image via the public policy, proving the seed
 *      is exercised. Also, they CAN see their own tenant's public
 *      image (a member policy path).
 *   2. Cross-tenant deny paths for Tenant A's private image:
 *        - by id
 *        - by exact `image_url`
 *        - bulk select scoped to Tenant A
 *        - unscoped `.in('id', [pub, priv])` enumeration
 *        - scoping to Tenant B returns zero Tenant A rows
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

type TenantBRole = "owner" | "admin" | "staff";
const ROLE_MATRIX: TenantBRole[] = ["owner", "admin", "staff"];

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
  publicResourceId: string;
  publicImageId: string;
  members: Record<TenantBRole, { userId: string; email: string; password: string }>;
}

interface Seeded {
  a: TenantASeed;
  b: TenantBSeed;
}

describe.runIf(canRun)("resource_images cross-tenant isolation matrix (Tenant B staff + non-staff)", () => {
  let service: SupabaseClient;
  let seeded: Seeded | null = null;
  const memberClients: Partial<Record<TenantBRole, SupabaseClient>> = {};

  beforeAll(async () => {
    service = newService();
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);

    // ---- Tenant A: owns the images under test -----------------------
    const { data: tA, error: tAErr } = await service
      .from("tenants")
      .insert({
        name: `CI XT-Mtx-A ${stamp}`,
        slug: `ci-resimg-xtmtx-a-${stamp}-${rand}`,
        tier: "basic",
        subscription_status: "trialing",
        is_active: true,
      })
      .select("id")
      .single();
    if (tAErr || !tA) throw tAErr ?? new Error("tenant A insert failed");
    const tenantAId = tA.id as string;

    async function seedResourceWithImage(
      ownerTenant: string,
      label: string,
      is_active: boolean,
      approval_status: "approved" | "pending",
    ): Promise<{ resourceId: string; imageId: string; imageUrl: string }> {
      const { data: res, error: rErr } = await service
        .from("resources")
        .insert({
          tenant_id: ownerTenant,
          name: `CI XT-Mtx ${label} ${stamp}`,
          resource_type: "table",
          is_active,
          approval_status,
        })
        .select("id")
        .single();
      if (rErr || !res) throw rErr ?? new Error(`resource insert failed for ${label}`);
      const imageUrl = `https://example.invalid/xtmtx-${label}-${stamp}-${rand}.jpg`;
      const { data: img, error: iErr } = await service
        .from("resource_images")
        .insert({
          tenant_id: ownerTenant,
          resource_id: res.id,
          image_url: imageUrl,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (iErr || !img) throw iErr ?? new Error(`image insert failed for ${label}`);
      return { resourceId: res.id as string, imageId: img.id as string, imageUrl };
    }

    const pub = await seedResourceWithImage(tenantAId, "a-public", true, "approved");
    const priv = await seedResourceWithImage(tenantAId, "a-private", false, "approved");

    // ---- Tenant B: unrelated tenant with one member per role --------
    const { data: tB, error: tBErr } = await service
      .from("tenants")
      .insert({
        name: `CI XT-Mtx-B ${stamp}`,
        slug: `ci-resimg-xtmtx-b-${stamp}-${rand}`,
        tier: "basic",
        subscription_status: "trialing",
        is_active: true,
      })
      .select("id")
      .single();
    if (tBErr || !tB) throw tBErr ?? new Error("tenant B insert failed");
    const tenantBId = tB.id as string;

    // Tenant B also has a public image so the within-tenant control has
    // something for its own members to observe via the member policy.
    const bPub = await seedResourceWithImage(tenantBId, "b-public", true, "approved");

    const members = {} as TenantBSeed["members"];
    for (const role of ROLE_MATRIX) {
      const email = `ci-resimg-xtmtx-${role}+${stamp}-${rand}@example.invalid`;
      const password = `Pw!${role}${rand}${stamp}`;
      const { data: created, error: cErr } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (cErr || !created?.user) throw cErr ?? new Error(`auth create failed for ${role}`);

      const { error: tuErr } = await service.from("tenant_users").insert({
        tenant_id: tenantBId,
        user_id: created.user.id,
        role,
        is_approved: true,
      });
      if (tuErr) throw tuErr;

      const client = newAnon();
      const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      memberClients[role] = client;
      members[role] = { userId: created.user.id, email, password };
    }

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
      b: {
        tenantId: tenantBId,
        publicResourceId: bPub.resourceId,
        publicImageId: bPub.imageId,
        members,
      },
    };
  }, 90_000);

  afterAll(async () => {
    for (const role of ROLE_MATRIX) {
      await memberClients[role]?.auth.signOut().catch(() => {});
    }
    if (!seeded) return;
    await service
      .from("resource_images")
      .delete()
      .in("id", [seeded.a.publicImageId, seeded.a.privateImageId, seeded.b.publicImageId]);
    await service
      .from("resources")
      .delete()
      .in("id", [
        seeded.a.publicResourceId,
        seeded.a.privateResourceId,
        seeded.b.publicResourceId,
      ]);
    const userIds = ROLE_MATRIX.map((r) => seeded!.b.members[r].userId);
    await service.from("tenant_users").delete().in("user_id", userIds);
    await service.from("tenants").delete().in("id", [seeded.a.tenantId, seeded.b.tenantId]);
    for (const uid of userIds) {
      await service.auth.admin.deleteUser(uid).catch(() => {});
    }
  }, 90_000);

  describe.each(ROLE_MATRIX)("Tenant B member with role=%s", (role) => {
    const client = (): SupabaseClient => {
      const c = memberClients[role];
      if (!c) throw new Error(`no client for role ${role}`);
      return c;
    };

    it("control: sees Tenant B's OWN public image (member policy path)", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await client()
        .from("resource_images")
        .select("id")
        .eq("id", seeded.b.publicImageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(seeded.b.publicImageId);
    });

    it("control: sees Tenant A's public image via the public policy", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await client()
        .from("resource_images")
        .select("id")
        .eq("id", seeded.a.publicImageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(seeded.a.publicImageId);
    });

    it("cannot fetch Tenant A's private image by id", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await client()
        .from("resource_images")
        .select("id, image_url")
        .eq("id", seeded.a.privateImageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("cannot fetch Tenant A's private image by exact image_url", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await client()
        .from("resource_images")
        .select("id")
        .eq("image_url", seeded.a.privateImageUrl)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("bulk select scoped to Tenant A does not disclose the private image", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await client()
        .from("resource_images")
        .select("id")
        .eq("tenant_id", seeded.a.tenantId);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.a.publicImageId].sort());
      expect(ids).not.toContain(seeded.a.privateImageId);
    });

    it("unscoped .in([pub, priv]) leaks only Tenant A's public image", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await client()
        .from("resource_images")
        .select("id")
        .in("id", [seeded.a.publicImageId, seeded.a.privateImageId]);
      expect(error).toBeNull();
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([seeded.a.publicImageId].sort());
      expect(ids).not.toContain(seeded.a.privateImageId);
    });

    it("scoping by Tenant B returns zero Tenant A rows", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await client()
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
  });

  // ---- Anonymous baseline in the same suite so the control set is one -
  describe("anonymous baseline", () => {
    it("control: anon can see Tenant A's public image", async () => {
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

    it("anon cannot fetch Tenant A's private image by id", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon
        .from("resource_images")
        .select("id")
        .eq("id", seeded.a.privateImageId)
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
  });
});

describe.skipIf(canRun)(
  "resource_images cross-tenant isolation matrix (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
