/**
 * Cross-tenant storage denial via id / image_url lookup for `resource_images`.
 *
 * This test exercises the realistic attacker workflow: instead of
 * knowing the exact object path, the attacker knows (or guesses) the
 * image row's `id` and/or the exact `image_url` string. We prove that:
 *
 *   1. Anon and a Tenant B member cannot even resolve Tenant A's
 *      private image row by `id` or by `image_url` (RLS hides it).
 *   2. Even if they somehow already possess the exact `image_url`
 *      string (leaked in a share link, a screenshot, etc.), fetching
 *      that URL returns >= 400 because the `tenant-assets` bucket is
 *      private.
 *   3. Deriving an object path from the URL and asking the storage
 *      client for `.download(path)` or `.createSignedUrl(path, 60)`
 *      also yields no bytes.
 *
 * Sanity: the service role client CAN download the same object, so a
 * total bucket outage cannot masquerade as a security pass.
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

const BUCKET = "tenant-assets";
const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * Extract the storage object path from a getPublicUrl() result. The
 * shape is `.../storage/v1/object/public/<bucket>/<path>`.
 */
function objectPathFromPublicUrl(url: string, bucket: string): string {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) throw new Error(`unexpected public URL shape: ${url}`);
  return url.slice(idx + marker.length);
}

interface Seeded {
  tenantAId: string;
  tenantBId: string;
  resourceId: string;
  imageId: string;
  objectPath: string;
  publicUrl: string;
  fileBytes: Uint8Array;
  tenantBUser: { userId: string; email: string; password: string };
}

describe.runIf(canRun)(
  "resource_images: anon + Tenant B cannot fetch Tenant A private bytes via id or image_url",
  () => {
    let service: SupabaseClient;
    let tenantBClient: SupabaseClient | null = null;
    let seeded: Seeded | null = null;

    beforeAll(async () => {
      service = newService();
      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      // ---- Tenant A: owns the private image -------------------------
      const { data: tA, error: tAErr } = await service
        .from("tenants")
        .insert({
          name: `CI XT-IdUrl-A ${stamp}`,
          slug: `ci-resimg-xtidurl-a-${stamp}-${rand}`,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tAErr || !tA) throw tAErr ?? new Error("tenant A insert failed");
      const tenantAId = tA.id as string;

      // Inactive parent -> row is not anon/cross-tenant readable.
      const { data: res, error: rErr } = await service
        .from("resources")
        .insert({
          tenant_id: tenantAId,
          name: `CI XT-IdUrl private ${stamp}`,
          resource_type: "table",
          is_active: false,
          approval_status: "approved",
        })
        .select("id")
        .single();
      if (rErr || !res) throw rErr ?? new Error("resource insert failed");
      const resourceId = res.id as string;

      const fileName = `gallery-${stamp}.jpg`;
      const objectPath = `${tenantAId}/resources/${resourceId}/${fileName}`;
      const fileBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x55, 0x66, 0x77, 0x88]);

      const { error: upErr } = await service.storage
        .from(BUCKET)
        .upload(objectPath, fileBytes, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(objectPath);
      const publicUrl = urlData.publicUrl;

      const { data: img, error: iErr } = await service
        .from("resource_images")
        .insert({
          tenant_id: tenantAId,
          resource_id: resourceId,
          image_url: publicUrl,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (iErr || !img) throw iErr ?? new Error("image row insert failed");

      // ---- Tenant B with a single staff member ----------------------
      const { data: tB, error: tBErr } = await service
        .from("tenants")
        .insert({
          name: `CI XT-IdUrl-B ${stamp}`,
          slug: `ci-resimg-xtidurl-b-${stamp}-${rand}`,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tBErr || !tB) throw tBErr ?? new Error("tenant B insert failed");
      const tenantBId = tB.id as string;

      const email = `ci-resimg-xtidurl+${stamp}-${rand}@example.invalid`;
      const password = `Pw!staff${rand}${stamp}`;
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

      tenantBClient = newAnon();
      const { error: signInErr } = await tenantBClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) throw signInErr;

      seeded = {
        tenantAId,
        tenantBId,
        resourceId,
        imageId: img.id as string,
        objectPath,
        publicUrl,
        fileBytes,
        tenantBUser: { userId: created.user.id, email, password },
      };
    }, 90_000);

    afterAll(async () => {
      await tenantBClient?.auth.signOut().catch(() => {});
      if (!seeded) return;
      await service.storage.from(BUCKET).remove([seeded.objectPath]).catch(() => {});
      await service.from("resource_images").delete().eq("id", seeded.imageId);
      await service.from("resources").delete().eq("id", seeded.resourceId);
      await service.from("tenant_users").delete().eq("user_id", seeded.tenantBUser.userId);
      await service.from("tenants").delete().in("id", [seeded.tenantAId, seeded.tenantBId]);
      await service.auth.admin.deleteUser(seeded.tenantBUser.userId).catch(() => {});
    }, 90_000);

    it("sanity: service role CAN download the seeded object", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await service.storage.from(BUCKET).download(seeded.objectPath);
      expect(error).toBeNull();
      expect(data).toBeTruthy();
      const bytes = new Uint8Array(await (data as Blob).arrayBuffer());
      expect(bytes.length).toBe(seeded.fileBytes.length);
    });

    type Caller = { kind: "anon" } | { kind: "tenantB" };
    const CALLERS: Caller[] = [{ kind: "anon" }, { kind: "tenantB" }];

    const label = (c: Caller) => (c.kind === "anon" ? "anon" : "Tenant B staff");

    function clientFor(caller: Caller): SupabaseClient {
      if (caller.kind === "anon") return newAnon();
      if (!tenantBClient) throw new Error("tenant B client missing");
      return tenantBClient;
    }

    describe.each(CALLERS)("caller=%s", (caller) => {
      const name = label(caller);

      it(`${name}: cannot resolve private image path via SELECT by id`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const { data, error } = await c
          .from("resource_images")
          .select("id, image_url")
          .eq("id", seeded.imageId)
          .maybeSingle();
        expect(error).toBeNull();
        expect(data).toBeNull();
      });

      it(`${name}: cannot resolve private image path via SELECT by image_url`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const { data, error } = await c
          .from("resource_images")
          .select("id, image_url")
          .eq("image_url", seeded.publicUrl)
          .maybeSingle();
        expect(error).toBeNull();
        expect(data).toBeNull();
      });

      it(`${name}: fetching the exact known image_url returns >= 400`, async () => {
        if (!seeded) throw new Error("seed missing");
        // Simulate the attacker already possessing the URL from an
        // out-of-band leak — the bucket is private so it must not serve.
        const resp = await fetch(seeded.publicUrl);
        await resp.arrayBuffer();
        expect(resp.ok).toBe(false);
        expect(resp.status).toBeGreaterThanOrEqual(400);
      });

      it(`${name}: .storage.download(path derived from image_url) is denied`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const path = objectPathFromPublicUrl(seeded.publicUrl, BUCKET);
        expect(path).toBe(seeded.objectPath);
        const { data, error } = await c.storage.from(BUCKET).download(path);
        expect(data).toBeNull();
        expect(error).not.toBeNull();
      });

      it(`${name}: .storage.createSignedUrl(path derived from image_url) yields no fetchable bytes`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const path = objectPathFromPublicUrl(seeded.publicUrl, BUCKET);
        const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, 60);
        if (error) {
          expect(data?.signedUrl ?? null).toBeNull();
        } else {
          expect(data?.signedUrl).toBeTruthy();
          const resp = await fetch(data!.signedUrl);
          await resp.arrayBuffer();
          expect(resp.ok).toBe(false);
        }
      });
    });
  },
);

describe.skipIf(canRun)(
  "resource_images cross-tenant storage by id/url denial (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
