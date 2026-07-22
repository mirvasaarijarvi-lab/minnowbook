/**
 * Storage bucket isolation regression: even though anon SELECT on the
 * `resource_images` metadata row is permitted for active + approved
 * parents, the underlying bytes in the `tenant-assets` bucket are
 * private. Anon must NOT be able to download the file via any storage
 * API surface, whether they know the exact object path, the image row
 * id, or the public URL echoed back from `getPublicUrl`.
 *
 * Checks (all as anon):
 *   1. `.storage.from('tenant-assets').download(path)` fails.
 *   2. `.storage.from('tenant-assets').createSignedUrl(path, 60)` fails.
 *   3. `.storage.from('tenant-assets').list(prefix)` does not disclose the
 *      object (empty or errored — never a hit).
 *   4. Raw HTTP GET on the private object endpoint
 *      (`/storage/v1/object/tenant-assets/<path>`) returns a non-2xx.
 *   5. Raw HTTP GET on the public object endpoint
 *      (`/storage/v1/object/public/tenant-assets/<path>`) returns a
 *      non-2xx, because the bucket is private.
 *   6. Discovering the object path through the metadata row (anon SELECT
 *      returns `image_url`) still doesn't grant bytes access.
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

interface Seeded {
  tenantId: string;
  resourceId: string;
  imageId: string;
  objectPath: string;
  prefix: string;
  fileBytes: Uint8Array;
  publicUrl: string;
}

describe.runIf(canRun)(
  "resource_images bytes in tenant-assets bucket are not anon-downloadable",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;

    beforeAll(async () => {
      service = newService();

      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const slug = `ci-resimg-storage-${stamp}-${rand}`;

      const { data: tenant, error: tenantErr } = await service
        .from("tenants")
        .insert({
          name: `CI Resource-Images-Storage ${stamp}`,
          slug,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tenantErr || !tenant) throw tenantErr ?? new Error("tenant insert returned no row");
      const tenantId = tenant.id as string;

      // Parent resource is active + approved so the metadata row IS
      // readable to anon. That's the whole point: metadata readable, bytes
      // still private.
      const { data: res, error: resErr } = await service
        .from("resources")
        .insert({
          tenant_id: tenantId,
          name: `CI storage ${stamp}`,
          resource_type: "table",
          is_active: true,
          approval_status: "approved",
        })
        .select("id")
        .single();
      if (resErr || !res) throw resErr ?? new Error("resource insert failed");
      const resourceId = res.id as string;

      // Mirror the app's upload path shape.
      const fileName = `gallery-${stamp}.jpg`;
      const prefix = `${tenantId}/resources/${resourceId}`;
      const objectPath = `${prefix}/${fileName}`;
      // 1x1 red JPEG-ish payload; content type is what matters for the
      // download response, not the bytes themselves.
      const fileBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01, 0x02, 0x03]);

      const { error: upErr } = await service.storage
        .from(BUCKET)
        .upload(objectPath, fileBytes, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      // Public URL is what the app persists into image_url. For a private
      // bucket this URL is guessable but not authorised.
      const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(objectPath);
      const publicUrl = urlData.publicUrl;

      const { data: img, error: imgErr } = await service
        .from("resource_images")
        .insert({
          tenant_id: tenantId,
          resource_id: resourceId,
          image_url: publicUrl,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (imgErr || !img) throw imgErr ?? new Error("image row insert failed");

      seeded = {
        tenantId,
        resourceId,
        imageId: img.id as string,
        objectPath,
        prefix,
        fileBytes,
        publicUrl,
      };
    }, 60_000);

    afterAll(async () => {
      if (!seeded) return;
      await service.storage.from(BUCKET).remove([seeded.objectPath]).catch(() => {});
      await service.from("resource_images").delete().eq("id", seeded.imageId);
      await service.from("resources").delete().eq("id", seeded.resourceId);
      await service.from("tenants").delete().eq("id", seeded.tenantId);
    }, 60_000);

    it("sanity check: service role CAN download the seeded bytes", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await service.storage.from(BUCKET).download(seeded.objectPath);
      expect(error).toBeNull();
      expect(data).toBeTruthy();
      const bytes = new Uint8Array(await (data as Blob).arrayBuffer());
      expect(bytes.length).toBe(seeded.fileBytes.length);
    });

    it("anon .storage.download() is denied for a known object path", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon.storage.from(BUCKET).download(seeded.objectPath);
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("anon .storage.createSignedUrl() is denied for a known object path", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon.storage.from(BUCKET).createSignedUrl(seeded.objectPath, 60);
      // Either the call errors, or (defensively) it hands back a URL that
      // is itself unauthorised — assert both properties.
      if (error) {
        expect(data?.signedUrl ?? null).toBeNull();
      } else {
        expect(data?.signedUrl).toBeTruthy();
        const resp = await fetch(data!.signedUrl);
        await resp.text();
        expect(resp.ok).toBe(false);
      }
    });

    it("anon .storage.list() does not disclose the object under the resource prefix", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const { data, error } = await anon.storage.from(BUCKET).list(seeded.prefix);
      // Listing may either error (RLS denies) or return nothing. It must
      // never leak the seeded filename to anon.
      const names = (data ?? []).map((entry) => entry.name);
      const fileName = seeded.objectPath.split("/").pop()!;
      expect(names).not.toContain(fileName);
      if (!error) {
        // Belt-and-braces: even on a successful empty listing, no entry
        // should match the seeded object.
        expect(names.length).toBe(0);
      }
    });

    it("raw GET on /storage/v1/object/<bucket>/<path> (private endpoint) is not 2xx for anon", async () => {
      if (!seeded) throw new Error("seed missing");
      const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${seeded.objectPath}`;
      const resp = await fetch(url, {
        headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${SUPABASE_ANON_KEY!}` },
      });
      await resp.arrayBuffer();
      expect(resp.ok).toBe(false);
      expect(resp.status).toBeGreaterThanOrEqual(400);
    });

    it("raw GET on /storage/v1/object/public/<bucket>/<path> is not 2xx (bucket is private)", async () => {
      if (!seeded) throw new Error("seed missing");
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${seeded.objectPath}`;
      const resp = await fetch(url);
      await resp.arrayBuffer();
      expect(resp.ok).toBe(false);
      expect(resp.status).toBeGreaterThanOrEqual(400);
    });

    it("even after resolving the object path via the anon-readable image_url, bytes are not fetchable", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      // 1. Confirm anon can see the metadata row and read image_url.
      const { data: row, error: rowErr } = await anon
        .from("resource_images")
        .select("id, image_url")
        .eq("id", seeded.imageId)
        .maybeSingle();
      expect(rowErr).toBeNull();
      expect(row?.image_url).toBeTruthy();

      // 2. Follow that exact URL — must not return the bytes.
      const resp = await fetch(row!.image_url as string);
      await resp.arrayBuffer();
      expect(resp.ok).toBe(false);
    });
  },
);

describe.skipIf(canRun)(
  "resource_images storage bytes non-download for anon (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
