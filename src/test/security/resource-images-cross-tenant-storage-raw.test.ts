/**
 * Cross-tenant storage-bytes denial for `resource_images`.
 *
 * Complements the metadata-focused cross-tenant matrix by proving that
 * even if a Tenant B caller (or an anon caller) somehow learns the
 * exact object path of a Tenant A private image, they still cannot
 * pull the bytes from the `tenant-assets` bucket via any raw
 * storage/public object endpoint.
 *
 * We seed Tenant A with a genuinely private image: the parent resource
 * is INACTIVE, which means the metadata row is not anon-readable and
 * cross-tenant callers cannot enumerate it. The file bytes exist in
 * the bucket under the standard `{tenantId}/resources/{resourceId}/…`
 * layout. We then hand the exact path to every caller under test.
 *
 * Callers under test:
 *   - anonymous
 *   - Tenant B owner
 *   - Tenant B admin
 *   - Tenant B staff
 *
 * Denied access paths (per caller):
 *   1. `.storage.from(bucket).download(path)` — must error, no bytes.
 *   2. `.storage.from(bucket).createSignedUrl(path, 60)` — either
 *      errors, or the returned URL itself is not authorised.
 *   3. Raw GET `/storage/v1/object/tenant-assets/<path>` (private) —
 *      status must be >= 400.
 *   4. Raw GET `/storage/v1/object/public/tenant-assets/<path>`
 *      (public alias, but bucket is private) — status must be >= 400.
 *   5. GET the exact `getPublicUrl(path)` URL — status must be >= 400.
 *
 * Sanity: the service role client CAN download the same object, so a
 * total bucket outage or wrong path would fail loudly instead of
 * masquerading as a security pass.
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
  publicUrl: string;
  fileBytes: Uint8Array;
  members: Record<TenantBRole, { userId: string; email: string; password: string }>;
}

describe.runIf(canRun)(
  "resource_images cross-tenant raw storage bytes denial",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;
    const memberClients: Partial<Record<TenantBRole, SupabaseClient>> = {};

    beforeAll(async () => {
      service = newService();
      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      // ---- Tenant A: owns the private image under test ---------------
      const { data: tA, error: tAErr } = await service
        .from("tenants")
        .insert({
          name: `CI XT-Storage-A ${stamp}`,
          slug: `ci-resimg-xtstor-a-${stamp}-${rand}`,
          tier: "basic",
          subscription_status: "trialing",
          is_active: true,
        })
        .select("id")
        .single();
      if (tAErr || !tA) throw tAErr ?? new Error("tenant A insert failed");
      const tenantAId = tA.id as string;

      // Parent resource INACTIVE -> row not anon/cross-tenant readable.
      // The bytes still exist in storage and we deliberately hand the
      // path to every caller under test.
      const { data: res, error: rErr } = await service
        .from("resources")
        .insert({
          tenant_id: tenantAId,
          name: `CI XT-Storage private ${stamp}`,
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
      const fileBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x11, 0x22, 0x33, 0x44]);

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

      // ---- Tenant B: one member per role -----------------------------
      const { data: tB, error: tBErr } = await service
        .from("tenants")
        .insert({
          name: `CI XT-Storage-B ${stamp}`,
          slug: `ci-resimg-xtstor-b-${stamp}-${rand}`,
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
        const email = `ci-resimg-xtstor-${role}+${stamp}-${rand}@example.invalid`;
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
        publicUrl,
        fileBytes,
        members,
      };
    }, 90_000);

    afterAll(async () => {
      for (const role of ROLE_MATRIX) {
        await memberClients[role]?.auth.signOut().catch(() => {});
      }
      if (!seeded) return;
      await service.storage.from(BUCKET).remove([seeded.objectPath]).catch(() => {});
      await service.from("resource_images").delete().eq("id", seeded.imageId);
      await service.from("resources").delete().eq("id", seeded.resourceId);
      const userIds = ROLE_MATRIX.map((r) => seeded!.members[r].userId);
      await service.from("tenant_users").delete().in("user_id", userIds);
      await service.from("tenants").delete().in("id", [seeded.tenantAId, seeded.tenantBId]);
      for (const uid of userIds) {
        await service.auth.admin.deleteUser(uid).catch(() => {});
      }
    }, 90_000);

    it("sanity: service role CAN download the seeded object", async () => {
      if (!seeded) throw new Error("seed missing");
      const { data, error } = await service.storage.from(BUCKET).download(seeded.objectPath);
      expect(error).toBeNull();
      expect(data).toBeTruthy();
      const bytes = new Uint8Array(await (data as Blob).arrayBuffer());
      expect(bytes.length).toBe(seeded.fileBytes.length);
    });

    type Caller =
      | { kind: "anon" }
      | { kind: "member"; role: TenantBRole };

    const CALLERS: Caller[] = [
      { kind: "anon" },
      ...ROLE_MATRIX.map<Caller>((role) => ({ kind: "member", role })),
    ];

    async function tokenFor(caller: Caller): Promise<string> {
      if (caller.kind === "anon") return SUPABASE_ANON_KEY!;
      const client = memberClients[caller.role];
      if (!client) throw new Error(`no client for role ${caller.role}`);
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(`no access token for role ${caller.role}`);
      return token;
    }

    function clientFor(caller: Caller): SupabaseClient {
      if (caller.kind === "anon") return newAnon();
      const c = memberClients[caller.role];
      if (!c) throw new Error(`no client for role ${caller.role}`);
      return c;
    }

    const label = (caller: Caller): string =>
      caller.kind === "anon" ? "anon" : `Tenant B ${caller.role}`;

    describe.each(CALLERS)("caller=%s", (caller) => {
      const name = label(caller);

      it(`${name}: .storage.download(exact path) is denied`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const { data, error } = await c.storage.from(BUCKET).download(seeded.objectPath);
        expect(data).toBeNull();
        expect(error).not.toBeNull();
      });

      it(`${name}: .storage.createSignedUrl(exact path) does not yield fetchable bytes`, async () => {
        if (!seeded) throw new Error("seed missing");
        const c = clientFor(caller);
        const { data, error } = await c.storage
          .from(BUCKET)
          .createSignedUrl(seeded.objectPath, 60);
        if (error) {
          expect(data?.signedUrl ?? null).toBeNull();
        } else {
          expect(data?.signedUrl).toBeTruthy();
          const resp = await fetch(data!.signedUrl);
          await resp.arrayBuffer();
          expect(resp.ok).toBe(false);
        }
      });

      it(`${name}: raw GET /storage/v1/object/<bucket>/<path> returns >= 400`, async () => {
        if (!seeded) throw new Error("seed missing");
        const token = await tokenFor(caller);
        const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${seeded.objectPath}`;
        const resp = await fetch(url, {
          headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
        });
        await resp.arrayBuffer();
        expect(resp.ok).toBe(false);
        expect(resp.status).toBeGreaterThanOrEqual(400);
      });

      it(`${name}: raw GET /storage/v1/object/public/<bucket>/<path> returns >= 400 (bucket is private)`, async () => {
        if (!seeded) throw new Error("seed missing");
        const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${seeded.objectPath}`;
        const resp = await fetch(url);
        await resp.arrayBuffer();
        expect(resp.ok).toBe(false);
        expect(resp.status).toBeGreaterThanOrEqual(400);
      });

      it(`${name}: GET the exact getPublicUrl() URL returns >= 400`, async () => {
        if (!seeded) throw new Error("seed missing");
        const resp = await fetch(seeded.publicUrl);
        await resp.arrayBuffer();
        expect(resp.ok).toBe(false);
        expect(resp.status).toBeGreaterThanOrEqual(400);
      });
    });
  },
);

describe.skipIf(canRun)(
  "resource_images cross-tenant raw storage bytes denial (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
