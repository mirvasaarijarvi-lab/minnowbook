/**
 * Cross-tenant WRITE denial for `resource_images` and the underlying
 * `tenant-assets` storage bytes.
 *
 * Complements the read-side cross-tenant suites by proving that neither
 * anonymous callers nor Tenant B members (owner/admin/staff) can mutate
 * a Tenant A private image, whether they aim at:
 *
 *   A. the `resource_images` metadata row (INSERT/UPDATE/DELETE via
 *      PostgREST), or
 *   B. the storage bytes in `tenant-assets` under Tenant A's prefix
 *      (upload/upload-with-upsert/update/remove/move/copy).
 *
 * Seeding shape mirrors `resource-images-cross-tenant-storage-raw`:
 * Tenant A owns an INACTIVE parent resource with one seeded image row
 * and one uploaded object at `{tenantAId}/resources/{resourceId}/…`.
 * Tenant B has one member per role. Each caller is then handed the
 * exact resource/image ids and object path.
 *
 * Sanity: after every mutation attempt the seeded row's `sort_order`
 * and the seeded object's byte length are re-read via the service
 * role client and asserted unchanged, so a "silently ignored" attempt
 * that actually succeeded would fail the assertion loudly.
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

type TenantBRole = "owner" | "admin" | "staff";
const ROLE_MATRIX: TenantBRole[] = ["owner", "admin", "staff"];

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
  resourceId: string;
  imageId: string;
  objectPath: string;
  fileBytes: Uint8Array;
  members: Record<TenantBRole, { userId: string; email: string; password: string }>;
}

describe.runIf(canRun)(
  "resource_images cross-tenant write denial (row + storage bytes)",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;
    const memberClients: Partial<Record<TenantBRole, SupabaseClient>> = {};

    beforeAll(async () => {
      service = newService();
      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      const { data: tA, error: tAErr } = await service
        .from("tenants")
        .insert({
          name: `CI XT-Mut-A ${stamp}`,
          slug: `ci-resimg-xtmut-a-${stamp}-${rand}`,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tAErr || !tA) throw tAErr ?? new Error("tenant A insert failed");
      const tenantAId = tA.id as string;

      // Inactive parent -> metadata row is not anon/cross-tenant readable,
      // and RLS on writes must still block cross-tenant mutations.
      const { data: res, error: rErr } = await service
        .from("resources")
        .insert({
          tenant_id: tenantAId,
          name: `CI XT-Mut private ${stamp}`,
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
      const fileBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0xa1, 0xb2, 0xc3, 0xd4]);

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

      const { data: tB, error: tBErr } = await service
        .from("tenants")
        .insert({
          name: `CI XT-Mut-B ${stamp}`,
          slug: `ci-resimg-xtmut-b-${stamp}-${rand}`,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tBErr || !tB) throw tBErr ?? new Error("tenant B insert failed");
      const tenantBId = tB.id as string;

      const members = {} as Seeded["members"];
      for (const role of ROLE_MATRIX) {
        const email = `ci-resimg-xtmut-${role}+${stamp}-${rand}@example.invalid`;
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
        tenantAId,
        tenantBId,
        resourceId,
        imageId: img.id as string,
        objectPath,
        fileBytes,
        members,
      };
    }, 90_000);

    afterAll(async () => {
      for (const role of ROLE_MATRIX) {
        await memberClients[role]?.auth.signOut().catch(() => {});
      }
      if (!seeded) return;
      // Best-effort cleanup of any object a bypass might have created.
      await service.storage.from(BUCKET).remove([seeded.objectPath]).catch(() => {});
      const attackerPath = `${seeded.tenantAId}/resources/${seeded.resourceId}/attacker.jpg`;
      await service.storage.from(BUCKET).remove([attackerPath]).catch(() => {});
      await service.from("resource_images").delete().eq("resource_id", seeded.resourceId);
      await service.from("resources").delete().eq("id", seeded.resourceId);
      const userIds = ROLE_MATRIX.map((r) => seeded!.members[r].userId);
      await service.from("tenant_users").delete().in("user_id", userIds);
      await service.from("tenants").delete().in("id", [seeded.tenantAId, seeded.tenantBId]);
      for (const uid of userIds) {
        await service.auth.admin.deleteUser(uid).catch(() => {});
      }
    }, 90_000);

    type Caller =
      | { kind: "anon" }
      | { kind: "member"; role: TenantBRole };

    const CALLERS: Caller[] = [
      { kind: "anon" },
      ...ROLE_MATRIX.map<Caller>((role) => ({ kind: "member", role })),
    ];

    const label = (caller: Caller): string =>
      caller.kind === "anon" ? "anon" : `Tenant B ${caller.role}`;

    function clientFor(caller: Caller): SupabaseClient {
      if (caller.kind === "anon") return newAnon();
      const c = memberClients[caller.role];
      if (!c) throw new Error(`no client for role ${caller.role}`);
      return c;
    }

    // Guardrails re-read the untouched state through the service role
    // so a silent success would fail the assertion loudly.
    async function assertRowUnchanged() {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await service
        .from("resource_images")
        .select("id, sort_order, tenant_id, resource_id")
        .eq("id", seeded.imageId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.tenant_id).toBe(seeded.tenantAId);
      expect(data!.resource_id).toBe(seeded.resourceId);
      expect(data!.sort_order).toBe(0);
    }
    async function assertObjectUnchanged() {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await service.storage.from(BUCKET).download(seeded.objectPath);
      expect(error).toBeNull();
      const bytes = new Uint8Array(await (data as Blob).arrayBuffer());
      expect(bytes.length).toBe(seeded.fileBytes.length);
      // First 4 bytes are the recognizable JPEG-ish marker we seeded.
      expect(Array.from(bytes.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    }

    it("sanity: seeded row and seeded object exist at baseline", async () => {
      await assertRowUnchanged();
      await assertObjectUnchanged();
    });

    describe.each(CALLERS)("caller=%s", (caller) => {
      const name = label(caller);

      // ---- resource_images row mutations ---------------------------
      it(`${name}: cannot INSERT a resource_images row into Tenant A`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const { data, error } = await c
          .from("resource_images")
          .insert({
            tenant_id: seeded.tenantAId,
            resource_id: seeded.resourceId,
            image_url: "https://attacker.invalid/pwn.jpg",
            sort_order: 999,
          })
          .select("id");
        // Either RLS/permission errors, or the insert is silently
        // filtered (data === null/[]). In no case may an id come back.
        expect((data ?? []).length).toBe(0);
        if (!error) {
          // Extra guard: nothing new landed for this resource.
          const { data: rows } = await service
            .from("resource_images")
            .select("id, image_url")
            .eq("resource_id", seeded.resourceId);
          expect(rows?.length ?? 0).toBe(1);
          expect(rows?.[0].image_url).not.toContain("attacker.invalid");
        }
        await assertRowUnchanged();
      });

      it(`${name}: cannot UPDATE the Tenant A image row`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const { data, error } = await c
          .from("resource_images")
          .update({ sort_order: 424242, image_url: "https://attacker.invalid/pwn.jpg" })
          .eq("id", seeded.imageId)
          .select("id");
        expect((data ?? []).length).toBe(0);
        // Whether it errored or was filtered to zero rows, state must
        // still be identical to seed.
        void error;
        await assertRowUnchanged();
      });

      it(`${name}: cannot DELETE the Tenant A image row`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const { data, error } = await c
          .from("resource_images")
          .delete()
          .eq("id", seeded.imageId)
          .select("id");
        expect((data ?? []).length).toBe(0);
        void error;
        await assertRowUnchanged();
      });

      // ---- tenant-assets storage bytes mutations -------------------
      it(`${name}: cannot UPLOAD a new object under Tenant A's prefix`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const attackerPath = `${seeded.tenantAId}/resources/${seeded.resourceId}/attacker.jpg`;
        const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
        const { data, error } = await c.storage
          .from(BUCKET)
          .upload(attackerPath, payload, { contentType: "image/jpeg", upsert: false });
        expect(error).not.toBeNull();
        expect(data).toBeNull();
        // Service role must not see any object landed at that path.
        const { data: dl } = await service.storage.from(BUCKET).download(attackerPath);
        expect(dl).toBeNull();
      });

      it(`${name}: cannot UPLOAD with upsert=true over the existing Tenant A object`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const payload = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
        const { data, error } = await c.storage
          .from(BUCKET)
          .upload(seeded.objectPath, payload, { contentType: "image/jpeg", upsert: true });
        expect(error).not.toBeNull();
        expect(data).toBeNull();
        await assertObjectUnchanged();
      });

      it(`${name}: cannot .storage.update() the existing Tenant A object`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const payload = new Uint8Array([0x99, 0x88, 0x77, 0x66]);
        const { data, error } = await c.storage
          .from(BUCKET)
          .update(seeded.objectPath, payload, { contentType: "image/jpeg" });
        expect(error).not.toBeNull();
        expect(data).toBeNull();
        await assertObjectUnchanged();
      });

      it(`${name}: cannot .storage.remove() the existing Tenant A object`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const { data, error } = await c.storage.from(BUCKET).remove([seeded.objectPath]);
        // The SDK returns { data: [] } on no-op removes for private
        // buckets in some versions, so check both signals plus the
        // ground truth: bytes are still there.
        if (error) {
          expect(error).not.toBeNull();
        } else {
          expect((data ?? []).length).toBe(0);
        }
        await assertObjectUnchanged();
      });

      it(`${name}: cannot .storage.move() the existing Tenant A object`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const dest = `${seeded.tenantAId}/resources/${seeded.resourceId}/moved.jpg`;
        const { data, error } = await c.storage.from(BUCKET).move(seeded.objectPath, dest);
        expect(error).not.toBeNull();
        expect(data).toBeNull();
        // Destination must not exist and source must be intact.
        const { data: dl } = await service.storage.from(BUCKET).download(dest);
        expect(dl).toBeNull();
        await assertObjectUnchanged();
      });

      it(`${name}: cannot .storage.copy() the existing Tenant A object`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const dest = `${seeded.tenantAId}/resources/${seeded.resourceId}/copy.jpg`;
        const { data, error } = await c.storage.from(BUCKET).copy(seeded.objectPath, dest);
        expect(error).not.toBeNull();
        expect(data).toBeNull();
        const { data: dl } = await service.storage.from(BUCKET).download(dest);
        expect(dl).toBeNull();
        await assertObjectUnchanged();
      });
    });
  },
);

describe.skipIf(canRun)(
  "resource_images cross-tenant write denial (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
