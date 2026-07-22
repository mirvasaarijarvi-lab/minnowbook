/**
 * Schema-invariant guard for `public.resource_images`.
 *
 * The anon SELECT policy on `resource_images` gates purely on the parent
 * `resources` row (`is_active = true AND approval_status = 'approved'`).
 * There is intentionally NO per-image visibility flag today.
 *
 * If someone adds a column like `is_public` / `public` / `visibility` /
 * `published` / `visible` without also updating the RLS policy, anon
 * consumers could start seeing images whose parents are inactive or
 * unapproved. This test fails loudly in that case so the policy is
 * reviewed alongside the schema change.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to read `information_schema`.
 * Missing creds skip cleanly.
 */
import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * Column names that would imply a per-image visibility flag. Any of these
 * appearing on `resource_images` means the anon RLS policy needs to be
 * re-evaluated to ensure parent gating still wins.
 */
const FORBIDDEN_VISIBILITY_COLUMNS = [
  "is_public",
  "public",
  "visibility",
  "published",
  "is_published",
  "visible",
  "is_visible",
  "listed",
  "is_listed",
];

/**
 * The exact set of columns `resource_images` is expected to have today.
 * If this drifts, the test surfaces it so the change is reviewed against
 * the anon SELECT policy.
 */
const EXPECTED_COLUMNS = [
  "id",
  "resource_id",
  "tenant_id",
  "image_url",
  "sort_order",
  "created_at",
].sort();

describe.runIf(canRun)("resource_images schema invariant (no per-image visibility flag)", () => {
  it("does not expose any forbidden per-image visibility column", async () => {
    const service = newService();
    const { data, error } = await service
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "resource_images");

    expect(error).toBeNull();
    const names = new Set((data ?? []).map((r) => String(r.column_name)));

    const leaked = FORBIDDEN_VISIBILITY_COLUMNS.filter((c) => names.has(c));
    expect(
      leaked,
      `resource_images grew a per-image visibility column (${leaked.join(", ")}). ` +
        "Review the anon SELECT policy so parent-resource gating still wins " +
        "before allowing this column.",
    ).toEqual([]);
  });

  it("matches the expected column set (schema drift guard)", async () => {
    const service = newService();
    const { data, error } = await service
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "resource_images");

    expect(error).toBeNull();
    const actual = (data ?? []).map((r) => String(r.column_name)).sort();
    expect(
      actual,
      "resource_images columns changed. If this is intentional, update " +
        "EXPECTED_COLUMNS AND re-review the anon SELECT policy for parent gating.",
    ).toEqual(EXPECTED_COLUMNS);
  });
});

describe.skipIf(canRun)("resource_images schema invariant (skipped: missing live creds)", () => {
  it("skipped: requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(true).toBe(true);
  });
});
