/**
 * RLS regression, pagination + ordering path: anonymous SELECTs against
 * `resource_images` must remain correctly filtered when the caller
 * applies `.order(...)` and `.range(...)`. Hidden rows (parent resource
 * inactive OR not approved) must never occupy a slot in the page window
 * — the "gap" from a filtered row must not shift a hidden row into
 * view, and the visible rows must arrive in the requested order.
 *
 * Locks in behaviour that pagination is applied AFTER the RLS filter
 * (PostgREST + Postgres semantics), not before — a regression here
 * would leak hidden rows onto later pages.
 *
 * Seeds one tenant with a mix of visible and hidden images so that a
 * naive "return the first N rows" implementation would necessarily
 * include a hidden row. Each visible image gets a distinct `sort_order`
 * that lets us assert exact ordering across pages.
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
  sortOrder: number;
  visible: boolean;
  label: string;
}

interface Seeded {
  tenantId: string;
  images: SeededImage[];
}

/**
 * Seed layout. Interleaves visible and hidden rows so that any
 * pagination window of size 2 spans a mix — if RLS were applied AFTER
 * `LIMIT`, at least one hidden row would appear in a page.
 *
 *   sort_order │ parent state           │ visible?
 *   ───────────┼────────────────────────┼─────────
 *        10    │ active   + approved    │  YES  V1
 *        20    │ inactive + approved    │  no   H1
 *        30    │ active   + approved    │  YES  V2
 *        40    │ active   + pending     │  no   H2
 *        50    │ active   + approved    │  YES  V3
 *        60    │ inactive + pending     │  no   H3
 *        70    │ active   + approved    │  YES  V4
 *        80    │ active   + rejected    │  no   H4
 *        90    │ active   + approved    │  YES  V5
 */
const SEED_PLAN: Array<{
  label: string;
  sort_order: number;
  is_active: boolean;
  approval_status: ApprovalStatus;
  visible: boolean;
}> = [
  { label: "V1", sort_order: 10, is_active: true, approval_status: "approved", visible: true },
  { label: "H1", sort_order: 20, is_active: false, approval_status: "approved", visible: false },
  { label: "V2", sort_order: 30, is_active: true, approval_status: "approved", visible: true },
  { label: "H2", sort_order: 40, is_active: true, approval_status: "pending", visible: false },
  { label: "V3", sort_order: 50, is_active: true, approval_status: "approved", visible: true },
  { label: "H3", sort_order: 60, is_active: false, approval_status: "pending", visible: false },
  { label: "V4", sort_order: 70, is_active: true, approval_status: "approved", visible: true },
  { label: "H4", sort_order: 80, is_active: true, approval_status: "rejected", visible: false },
  { label: "V5", sort_order: 90, is_active: true, approval_status: "approved", visible: true },
];

describe.runIf(canRun)("resource_images anon SELECT stays correctly filtered under pagination + ordering", () => {
  let service: SupabaseClient;
  let seeded: Seeded | null = null;

  beforeAll(async () => {
    service = newService();
    const stamp = Date.now();
    const suffix = `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
    const slug = `ci-resimg-page-${suffix}`;

    const { data: tenant, error: tErr } = await service
      .from("tenants")
      .insert({
        name: `CI ResImg Pagination ${stamp}`,
        slug,
        tier: "basic",
        subscription_status: "trialing",
        is_active: true,
      })
      .select("id")
      .single();
    if (tErr || !tenant) throw tErr ?? new Error("tenant insert failed");
    const tenantId = tenant.id as string;

    const images: SeededImage[] = [];
    for (const spec of SEED_PLAN) {
      const { data: res, error: rErr } = await service
        .from("resources")
        .insert({
          tenant_id: tenantId,
          name: `CI ${spec.label} ${stamp}`,
          resource_type: "table",
          is_active: spec.is_active,
          approval_status: spec.approval_status,
        })
        .select("id")
        .single();
      if (rErr || !res) throw rErr ?? new Error(`resource insert failed for ${spec.label}`);

      const { data: img, error: iErr } = await service
        .from("resource_images")
        .insert({
          tenant_id: tenantId,
          resource_id: res.id,
          image_url: `https://example.invalid/page-${spec.label}-${suffix}.jpg`,
          sort_order: spec.sort_order,
        })
        .select("id")
        .single();
      if (iErr || !img) throw iErr ?? new Error(`image insert failed for ${spec.label}`);

      images.push({
        imageId: img.id as string,
        resourceId: res.id as string,
        sortOrder: spec.sort_order,
        visible: spec.visible,
        label: spec.label,
      });
    }

    seeded = { tenantId, images };
  }, 60_000);

  afterAll(async () => {
    if (!seeded) return;
    const imageIds = seeded.images.map((i) => i.imageId);
    const resourceIds = seeded.images.map((i) => i.resourceId);
    await service.from("resource_images").delete().in("id", imageIds);
    await service.from("resources").delete().in("id", resourceIds);
    await service.from("tenants").delete().eq("id", seeded.tenantId);
  }, 60_000);

  function visibleAsc(seeded: Seeded): SeededImage[] {
    return seeded.images
      .filter((i) => i.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  function visibleDesc(seeded: Seeded): SeededImage[] {
    return [...visibleAsc(seeded)].reverse();
  }

  it("ascending order by sort_order returns visible rows in order and skips hidden ones entirely", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, sort_order")
      .eq("tenant_id", seeded.tenantId)
      .order("sort_order", { ascending: true });
    expect(error).toBeNull();
    const expected = visibleAsc(seeded);
    expect(data?.map((r) => r.id)).toEqual(expected.map((v) => v.imageId));
    expect(data?.map((r) => r.sort_order)).toEqual(expected.map((v) => v.sortOrder));
    // No hidden id can appear anywhere in the result.
    const hiddenIds = new Set(
      seeded.images.filter((i) => !i.visible).map((i) => i.imageId),
    );
    for (const row of data ?? []) {
      expect(hiddenIds.has(row.id)).toBe(false);
    }
  });

  it("descending order by sort_order returns visible rows in reverse and skips hidden ones", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, sort_order")
      .eq("tenant_id", seeded.tenantId)
      .order("sort_order", { ascending: false });
    expect(error).toBeNull();
    const expected = visibleDesc(seeded);
    expect(data?.map((r) => r.id)).toEqual(expected.map((v) => v.imageId));
    expect(data?.map((r) => r.sort_order)).toEqual(expected.map((v) => v.sortOrder));
  });

  it("paginating with .range(0, 1) returns the first two VISIBLE rows, not the first two overall rows", async () => {
    // Key regression: if pagination were applied before RLS, the first
    // window (rows 1 and 2 by sort_order) would be [V1, H1]. RLS must
    // strip H1 first, so we see [V1, V2].
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, sort_order")
      .eq("tenant_id", seeded.tenantId)
      .order("sort_order", { ascending: true })
      .range(0, 1);
    expect(error).toBeNull();
    const expected = visibleAsc(seeded).slice(0, 2);
    expect(data?.map((r) => r.id)).toEqual(expected.map((v) => v.imageId));
    expect(data?.map((r) => r.sort_order)).toEqual([10, 30]);
  });

  it("second page .range(2, 3) is contiguous with the first page and contains no hidden rows", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_images")
      .select("id, sort_order")
      .eq("tenant_id", seeded.tenantId)
      .order("sort_order", { ascending: true })
      .range(2, 3);
    expect(error).toBeNull();
    const expected = visibleAsc(seeded).slice(2, 4);
    expect(data?.map((r) => r.id)).toEqual(expected.map((v) => v.imageId));
    expect(data?.map((r) => r.sort_order)).toEqual([50, 70]);
  });

  it("walking every page yields exactly the visible set in order, with no duplicates or hidden leakage", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const pageSize = 2;
    const expected = visibleAsc(seeded);
    const collected: Array<{ id: string; sort_order: number }> = [];
    for (let from = 0; from < expected.length + pageSize; from += pageSize) {
      const { data, error } = await anon
        .from("resource_images")
        .select("id, sort_order")
        .eq("tenant_id", seeded.tenantId)
        .order("sort_order", { ascending: true })
        .range(from, from + pageSize - 1);
      expect(error).toBeNull();
      if (!data || data.length === 0) break;
      collected.push(...data);
    }
    expect(collected.map((r) => r.id)).toEqual(expected.map((v) => v.imageId));
    // No duplicates.
    expect(new Set(collected.map((r) => r.id)).size).toBe(collected.length);
    // No hidden row anywhere.
    const hiddenIds = new Set(
      seeded.images.filter((i) => !i.visible).map((i) => i.imageId),
    );
    for (const row of collected) {
      expect(hiddenIds.has(row.id)).toBe(false);
    }
  });

  it("requesting a page past the last visible row returns an empty result (not a hidden row)", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const expected = visibleAsc(seeded);
    const { data, error } = await anon
      .from("resource_images")
      .select("id")
      .eq("tenant_id", seeded.tenantId)
      .order("sort_order", { ascending: true })
      .range(expected.length, expected.length + 4);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("exact-count under an anon SELECT reports only the visible row count", async () => {
    if (!seeded) throw new Error("seed missing");
    const anon = newAnon();
    const { count, error } = await anon
      .from("resource_images")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", seeded.tenantId);
    expect(error).toBeNull();
    expect(count).toBe(visibleAsc(seeded).length);
  });
});

describe.skipIf(canRun)("resource_images anon pagination gating (skipped: missing live creds)", () => {
  it("skipped: requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(true).toBe(true);
  });
});
