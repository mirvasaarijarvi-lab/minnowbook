/**
 * RLS regression, individual-lookup path: an anonymous `.eq('id', ...)`
 * SELECT against `resource_images` must return NO row whenever the
 * parent resource is not both `is_active = true` AND
 * `approval_status = 'approved'`.
 *
 * This complements `resource-images-anon-select.test.ts` (which asserts
 * the collection-level filter) by pinning down the by-id lookup surface
 * that public detail pages hit. It also covers the doubly-gated
 * `inactive + pending` case, which the collection test doesn't.
 *
 * Matrix of parent resource states seeded under a disposable tenant:
 *
 *   ┌──────────┬──────────┬─────────┐
 *   │ is_active│ approval │ visible │
 *   ├──────────┼──────────┼─────────┤
 *   │ true     │ approved │  YES    │  (control — sanity check)
 *   │ false    │ approved │  no     │
 *   │ true     │ pending  │  no     │
 *   │ false    │ pending  │  no     │  (doubly-gated)
 *   │ true     │ rejected │  no     │  (moderation outcome)
 *   └──────────┴──────────┴─────────┘
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

const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

type ApprovalStatus = "approved" | "pending" | "rejected";

interface SeededImage {
  imageId: string;
  resourceId: string;
  imageUrl: string;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
}

interface Seeded {
  tenantId: string;
  activeApproved: SeededImage;
  inactiveApproved: SeededImage;
  activePending: SeededImage;
  inactivePending: SeededImage;
  activeRejected: SeededImage;
}

describe.runIf(canRun)("resource_images anon by-id SELECT is denied for non-visible parent states", () => {
  let service: SupabaseClient;
  let seeded: Seeded | null = null;

  beforeAll(async () => {
    service = newService();
    const stamp = Date.now();
    const suffix = `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
    const slug = `ci-resimg-byid-${suffix}`;

    const { data: tenant, error: tErr } = await service
      .from("tenants")
      .insert({
        name: `CI ResImg By-Id ${stamp}`,
        slug,
        tier: "basic",
        subscription_status: "trialing",
        is_active: true,
      })
      .select("id")
      .single();
    if (tErr || !tenant) throw tErr ?? new Error("tenant insert failed");
    const tenantId = tenant.id as string;

    async function seedOne(
      label: string,
      isActive: boolean,
      approvalStatus: ApprovalStatus,
    ): Promise<SeededImage> {
      const { data: res, error: rErr } = await service
        .from("resources")
        .insert({
          tenant_id: tenantId,
          name: `CI ${label} ${stamp}`,
          resource_type: "table",
          is_active: isActive,
          approval_status: approvalStatus,
        })
        .select("id")
        .single();
      if (rErr || !res) throw rErr ?? new Error(`resource insert failed for ${label}`);

      const imageUrl = `https://example.invalid/byid-${label}-${suffix}.jpg`;
      const { data: img, error: iErr } = await service
        .from("resource_images")
        .insert({
          tenant_id: tenantId,
          resource_id: res.id,
          image_url: imageUrl,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (iErr || !img) throw iErr ?? new Error(`image insert failed for ${label}`);

      return {
        imageId: img.id as string,
        resourceId: res.id as string,
        imageUrl,
        isActive,
        approvalStatus,
      };
    }

    seeded = {
      tenantId,
      activeApproved: await seedOne("active-approved", true, "approved"),
      inactiveApproved: await seedOne("inactive-approved", false, "approved"),
      activePending: await seedOne("active-pending", true, "pending"),
      inactivePending: await seedOne("inactive-pending", false, "pending"),
      activeRejected: await seedOne("active-rejected", true, "rejected"),
    };
  }, 60_000);

  afterAll(async () => {
    if (!seeded) return;
    const rows = [
      seeded.activeApproved,
      seeded.inactiveApproved,
      seeded.activePending,
      seeded.inactivePending,
      seeded.activeRejected,
    ];
    await service
      .from("resource_images")
      .delete()
      .in(
        "id",
        rows.map((r) => r.imageId),
      );
    await service
      .from("resources")
      .delete()
      .in(
        "id",
        rows.map((r) => r.resourceId),
      );
    await service.from("tenants").delete().eq("id", seeded.tenantId);
  }, 60_000);

  it("control: active + approved parent — by-id lookup returns the image", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, image_url")
      .eq("id", seeded.activeApproved.imageId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(seeded.activeApproved.imageId);
    expect(data?.image_url).toBe(seeded.activeApproved.imageUrl);
  });

  it("denies by-id lookup when the parent resource is inactive (approved but is_active=false)", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("id", seeded.inactiveApproved.imageId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("denies by-id lookup when the parent resource is pending moderation (active but approval_status='pending')", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("id", seeded.activePending.imageId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("denies by-id lookup when the parent resource is BOTH inactive AND pending", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("id", seeded.inactivePending.imageId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("denies by-id lookup when the parent resource was rejected in moderation", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("id", seeded.activeRejected.imageId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("a `.single()` by-id lookup against a hidden image surfaces PGRST116 (0 rows), not a leak", async () => {
    // `.single()` is stricter than `.maybeSingle()` and is what many
    // detail pages use. Confirm the RLS-hidden row manifests as the
    // canonical "no rows" error rather than an unexpected success.
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("id", seeded.inactiveApproved.imageId)
      .single();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // PostgREST returns code 'PGRST116' when a `.single()` yields zero
    // rows. Assert the code rather than the message to keep the test
    // resilient to PostgREST copy tweaks.
    expect(error?.code).toBe("PGRST116");
  });
});

describe.skipIf(canRun)("resource_images anon by-id denial (skipped: missing live creds)", () => {
  it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(true).toBe(true);
  });
});
