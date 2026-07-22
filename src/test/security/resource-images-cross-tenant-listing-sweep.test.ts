/**
 * Listing-shape sweep for `resource_images`: Tenant A's private image
 * (parent inactive) must not surface in ANY listing variant that anon or
 * a Tenant B member could plausibly try. Complements the id- and
 * image_url-based cross-tenant tests by exercising the PostgREST filter
 * combinations a curious client might guess.
 *
 * For each caller (anon, Tenant B staff member) and each listing shape,
 * we assert:
 *   - Tenant A's private image id is NOT in the returned set.
 *   - Any returned row's `tenant_id` matches the requested scope
 *     (belt-and-braces against a filter being dropped server-side).
 *
 * A within-tenant control confirms Tenant A's PUBLIC image IS visible
 * on the same listing shape when it should be, so a "no rows" assertion
 * can't be a silent empty seed.
 *
 * Listing shapes covered:
 *   1. Unscoped bulk select over the seeded pair (`.in('id', [...])`).
 *   2. Tenant-scoped bulk select (`.eq('tenant_id', A)`).
 *   3. Tenant-scoped + `.eq('sort_order', 0)`.
 *   4. Tenant-scoped + `.in('resource_id', [pub, priv])`.
 *   5. Tenant-scoped + `.order('created_at').limit(50)` (paginated).
 *   6. Tenant-scoped + `.range(0, 49)` (offset pagination).
 *   7. Tenant-scoped `HEAD` count (`{ count: 'exact', head: true }`).
 *   8. Unscoped `.or('id.eq.<priv>,image_url.eq.<privUrl>')`
 *      (attempt to disjunction-bypass parent gating).
 *   9. Tenant-scoped `.not('id', 'eq', '<random-uuid>')` (broad NOT filter).
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

interface Seeded {
  tenantAId: string;
  tenantBId: string;
  publicResourceId: string;
  publicImageId: string;
  privateResourceId: string;
  privateImageId: string;
  privateImageUrl: string;
  tenantBUserId: string;
}

describe.runIf(canRun)(
  "resource_images listing sweep: Tenant A private rows never leak to anon or Tenant B",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;
    let tenantBMember: SupabaseClient | null = null;

    beforeAll(async () => {
      service = newService();
      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      async function seedTenant(label: string): Promise<string> {
        const { data, error } = await service
          .from("tenants")
          .insert({
            name: `CI XT-List ${label} ${stamp}`,
            slug: `ci-resimg-list-${label}-${stamp}-${rand}`,
            tier: "basic",
            subscription_status: "trialing",
            is_active: true,
          })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error(`tenant insert failed for ${label}`);
        return data.id as string;
      }

      const tenantAId = await seedTenant("a");
      const tenantBId = await seedTenant("b");

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
            name: `CI XT-List ${label} ${stamp}`,
            resource_type: "table",
            is_active,
            approval_status,
          })
          .select("id")
          .single();
        if (rErr || !res) throw rErr ?? new Error(`resource insert failed for ${label}`);
        const imageUrl = `https://example.invalid/xtlist-${label}-${stamp}-${rand}.jpg`;
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

      const pub = await seedResourceWithImage(tenantAId, "public", true, "approved");
      const priv = await seedResourceWithImage(tenantAId, "private", false, "approved");

      const email = `ci-resimg-list+${stamp}-${rand}@example.invalid`;
      const password = `Pw!list${rand}${stamp}`;
      const { data: created, error: cErr } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (cErr || !created?.user) throw cErr ?? new Error("auth create failed");
      const { error: tuErr } = await service.from("tenant_users").insert({
        tenant_id: tenantBId,
        user_id: created.user.id,
        role: "staff",
        is_approved: true,
      });
      if (tuErr) throw tuErr;

      tenantBMember = newAnon();
      const { error: signInErr } = await tenantBMember.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;

      seeded = {
        tenantAId,
        tenantBId,
        publicResourceId: pub.resourceId,
        publicImageId: pub.imageId,
        privateResourceId: priv.resourceId,
        privateImageId: priv.imageId,
        privateImageUrl: priv.imageUrl,
        tenantBUserId: created.user.id,
      };
    }, 90_000);

    afterAll(async () => {
      if (tenantBMember) await tenantBMember.auth.signOut().catch(() => {});
      if (!seeded) return;
      await service
        .from("resource_images")
        .delete()
        .in("id", [seeded.publicImageId, seeded.privateImageId]);
      await service
        .from("resources")
        .delete()
        .in("id", [seeded.publicResourceId, seeded.privateResourceId]);
      await service.from("tenant_users").delete().eq("user_id", seeded.tenantBUserId);
      await service.from("tenants").delete().in("id", [seeded.tenantAId, seeded.tenantBId]);
      await service.auth.admin.deleteUser(seeded.tenantBUserId).catch(() => {});
    }, 60_000);

    type CallerLabel = "anon" | "tenantB_staff";
    const callers = (): Array<[CallerLabel, () => SupabaseClient]> => [
      ["anon", () => newAnon()],
      [
        "tenantB_staff",
        () => {
          if (!tenantBMember) throw new Error("Tenant B client missing");
          return tenantBMember;
        },
      ],
    ];

    describe.each(callers())("caller=%s", (_label, getClient) => {
      // Random UUID unlikely to exist — used for broad NOT filters below.
      const RANDOM_UUID = "00000000-0000-0000-0000-000000000000";

      it("control: sees Tenant A's public image on a tenant-scoped bulk select", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id, tenant_id")
          .eq("tenant_id", seeded.tenantAId);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).toContain(seeded.publicImageId);
        for (const row of data ?? []) {
          expect(row.tenant_id).toBe(seeded.tenantAId);
        }
      });

      it("1. unscoped `.in('id', [pub, priv])` leaks only the public image", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id")
          .in("id", [seeded.publicImageId, seeded.privateImageId]);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).not.toContain(seeded.privateImageId);
        expect(ids).toContain(seeded.publicImageId);
      });

      it("2. tenant-scoped bulk select never returns the private image", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id, tenant_id")
          .eq("tenant_id", seeded.tenantAId);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).not.toContain(seeded.privateImageId);
        for (const row of data ?? []) {
          expect(row.tenant_id).toBe(seeded.tenantAId);
        }
      });

      it("3. tenant-scoped + `.eq('sort_order', 0)` never returns the private image", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id, tenant_id, sort_order")
          .eq("tenant_id", seeded.tenantAId)
          .eq("sort_order", 0);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).not.toContain(seeded.privateImageId);
        for (const row of data ?? []) {
          expect(row.tenant_id).toBe(seeded.tenantAId);
        }
      });

      it("4. tenant-scoped + `.in('resource_id', [pub, priv])` never returns the private image", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id, tenant_id, resource_id")
          .eq("tenant_id", seeded.tenantAId)
          .in("resource_id", [seeded.publicResourceId, seeded.privateResourceId]);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).not.toContain(seeded.privateImageId);
        expect(ids).toContain(seeded.publicImageId);
        for (const row of data ?? []) {
          expect(row.tenant_id).toBe(seeded.tenantAId);
          expect(row.resource_id).toBe(seeded.publicResourceId);
        }
      });

      it("5. tenant-scoped + order+limit pagination never returns the private image", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id, tenant_id")
          .eq("tenant_id", seeded.tenantAId)
          .order("created_at", { ascending: false })
          .limit(50);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).not.toContain(seeded.privateImageId);
        for (const row of data ?? []) {
          expect(row.tenant_id).toBe(seeded.tenantAId);
        }
      });

      it("6. tenant-scoped + `.range(0, 49)` offset pagination never returns the private image", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id, tenant_id")
          .eq("tenant_id", seeded.tenantAId)
          .range(0, 49);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).not.toContain(seeded.privateImageId);
      });

      it("7. tenant-scoped HEAD count does not include the private image", async () => {
        if (!seeded) throw new Error("seed missing");
        // Total tenant-A count (anon-visible / member-visible) plus a
        // count restricted to the private image id — the second count
        // must be 0.
        const totalRes = await getClient()
          .from("resource_images")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", seeded.tenantAId);
        expect(totalRes.error).toBeNull();
        expect(totalRes.count ?? 0).toBeGreaterThanOrEqual(1);

        const privateRes = await getClient()
          .from("resource_images")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", seeded.tenantAId)
          .eq("id", seeded.privateImageId);
        expect(privateRes.error).toBeNull();
        expect(privateRes.count ?? 0).toBe(0);
      });

      it("8. unscoped `.or(id.eq.priv,image_url.eq.privUrl)` never returns the private image", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id")
          .or(`id.eq.${seeded.privateImageId},image_url.eq.${seeded.privateImageUrl}`);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).not.toContain(seeded.privateImageId);
      });

      it("9. tenant-scoped + broad `.not('id', 'eq', <random-uuid>)` never returns the private image", async () => {
        if (!seeded) throw new Error("seed missing");
        const { data, error } = await getClient()
          .from("resource_images")
          .select("id, tenant_id")
          .eq("tenant_id", seeded.tenantAId)
          .not("id", "eq", RANDOM_UUID);
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).not.toContain(seeded.privateImageId);
        for (const row of data ?? []) {
          expect(row.tenant_id).toBe(seeded.tenantAId);
        }
      });
    });
  },
);

describe.skipIf(canRun)(
  "resource_images listing sweep (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
