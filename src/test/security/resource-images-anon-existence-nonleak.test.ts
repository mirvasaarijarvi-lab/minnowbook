/**
 * RLS non-leak regression: anon SELECT on `resource_images` must not
 * expose the existence of a row whose parent resource is inactive,
 * pending, or rejected. The response for a gated id must match the
 * response for a fully random (non-existent) id, on every observable
 * axis:
 *   - HTTP status (via `.select(...)` with no filter modifier)
 *   - error object (null vs non-null, code, message)
 *   - returned rows (empty array / null)
 *   - PostgREST Content-Range header (row count)
 *
 * If the anon policy ever regresses to return a distinguishable signal
 * (e.g. a 406, a different error code, or a non-empty count) for gated
 * rows, this suite fails.
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

interface SeededImage {
  imageId: string;
  resourceId: string;
}

interface Seeded {
  tenantId: string;
  visible: SeededImage;
  inactive: SeededImage;
  pending: SeededImage;
  rejected: SeededImage;
}

// Random uuid v4 shape; overwhelmingly unlikely to collide with a real row.
function randomUuid(): string {
  return crypto.randomUUID();
}

// Fingerprint every observable channel the anon caller can inspect.
async function fingerprintById(anon: SupabaseClient, id: string) {
  // 1. `.select(...).eq('id', id)` — plain list query.
  const list = await anon.from("resource_images").select("id, resource_id, image_url").eq("id", id);
  // 2. `.maybeSingle()` — same query with single-row expectation.
  const single = await anon
    .from("resource_images")
    .select("id, resource_id, image_url")
    .eq("id", id)
    .maybeSingle();
  // 3. Exact-count HEAD — surfaces the row count PostgREST would return.
  const count = await anon
    .from("resource_images")
    .select("id", { count: "exact", head: true })
    .eq("id", id);

  return {
    list: {
      status: list.status,
      error: list.error?.code ?? null,
      errorMsg: list.error?.message ?? null,
      rowCount: list.data?.length ?? 0,
    },
    single: {
      status: single.status,
      error: single.error?.code ?? null,
      errorMsg: single.error?.message ?? null,
      hasRow: single.data !== null,
    },
    count: {
      status: count.status,
      error: count.error?.code ?? null,
      errorMsg: count.error?.message ?? null,
      count: count.count ?? 0,
    },
  };
}

describe.runIf(canRun)(
  "resource_images anon SELECT does not leak existence of gated rows",
  () => {
    let service: SupabaseClient;
    let seeded: Seeded | null = null;

    beforeAll(async () => {
      service = newService();

      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const slug = `ci-resimg-leak-${stamp}-${rand}`;

      const { data: tenant, error: tenantErr } = await service
        .from("tenants")
        .insert({
          name: `CI Resource-Images-Leak ${stamp}`,
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

        const { data: img, error: imgErr } = await service
          .from("resource_images")
          .insert({
            tenant_id: tenantId,
            resource_id: res.id,
            image_url: `https://example.invalid/${label}-${stamp}.jpg`,
            sort_order: 0,
          })
          .select("id")
          .single();
        if (imgErr || !img) throw imgErr ?? new Error(`image insert failed for ${label}`);

        return { imageId: img.id as string, resourceId: res.id as string };
      }

      seeded = {
        tenantId,
        visible: await seedOne("visible", true, "approved"),
        inactive: await seedOne("inactive", false, "approved"),
        pending: await seedOne("pending", true, "pending"),
        rejected: await seedOne("rejected", true, "rejected"),
      };
    }, 60_000);

    afterAll(async () => {
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
    }, 60_000);

    it("sanity check: an active + approved image is observably present to anon", async () => {
      if (!seeded) throw new Error("seed missing");
      const anon = newAnon();
      const fp = await fingerprintById(anon, seeded.visible.imageId);
      // Belt-and-braces: this row MUST look different from a gated / missing
      // row. If this ever becomes equal to `nonExistent`, the visible case
      // itself has regressed and every equality below is meaningless.
      expect(fp.list.rowCount).toBe(1);
      expect(fp.single.hasRow).toBe(true);
      expect(fp.count.count).toBe(1);
    });

    it.each([
      ["inactive parent (is_active=false, approved)", "inactive"],
      ["pending parent (approval_status='pending')", "pending"],
      ["rejected parent (approval_status='rejected')", "rejected"],
    ] as const)(
      "%s is indistinguishable from a truly non-existent id",
      async (_label, key) => {
        if (!seeded) throw new Error("seed missing");
        const anon = newAnon();
        const nonExistentId = randomUuid();

        const gated = await fingerprintById(anon, seeded[key].imageId);
        const missing = await fingerprintById(anon, nonExistentId);

        // Full-object equality across every observable channel. Any drift
        // (status, error code, error message, row count) fails the test.
        expect(gated).toEqual(missing);

        // Redundant explicit assertions to make failure diagnosis easier
        // when the deep-equal report is noisy.
        expect(gated.list.status).toBe(missing.list.status);
        expect(gated.list.rowCount).toBe(0);
        expect(gated.list.error).toBeNull();
        expect(gated.single.status).toBe(missing.single.status);
        expect(gated.single.hasRow).toBe(false);
        expect(gated.single.error).toBeNull();
        expect(gated.count.status).toBe(missing.count.status);
        expect(gated.count.count).toBe(0);
        expect(gated.count.error).toBeNull();
      },
    );
  },
);

describe.skipIf(canRun)(
  "resource_images anon existence non-leak (skipped: missing live creds)",
  () => {
    it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
