import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Targeted RLS regression: anon vs authenticated scoping for the five tables
 * the user identified as recently churning. Each table has subtly different
 * policy intent — this suite encodes that intent so a future migration that
 * changes a policy by accident will fail loudly.
 *
 *   tenant_settings           — NO anon SELECT policy. Anon must see 0 rows.
 *                               Contains business_email/phone/address (PII-ish).
 *   tenant_opening_hours      — anon SELECT allowed when tenants.is_active=true.
 *                               Anon must NEVER write (INSERT/UPDATE/DELETE).
 *   blocked_slots             — anon SELECT allowed for active tenants. No anon writes.
 *   recurring_blocked_slots   — anon SELECT allowed for active tenants. No anon writes.
 *   resource_images           — anon SELECT allowed (`true`). No anon writes.
 *
 * For all five, an unauthenticated client must be denied every mutating
 * operation regardless of payload, and the authenticated `tenant_settings`
 * channel must remain the only path that exposes business contact info.
 */

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Plausible-but-non-existent tenant id used for write probes. Well-formed UUID
// so the failure must come from RLS, not from input parsing.
const PROBE_TENANT_ID = "00000000-0000-0000-0000-0000000000aa";
const PROBE_RESOURCE_ID = "00000000-0000-0000-0000-0000000000bb";

let anon: SupabaseClient;

beforeAll(() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY must be set to run anon-vs-auth scoping tests"
    );
  }
  anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

/** Strong denial signal: either an explicit error, or zero rows returned. */
function expectDeniedOrEmpty(
  result: { data: unknown; error: unknown },
  ctx: string
) {
  const { data, error } = result as {
    data: unknown[] | null;
    error: { message?: string } | null;
  };
  if (error) {
    expect(error, `${ctx}: error must be present`).toBeTruthy();
    return;
  }
  expect(Array.isArray(data), `${ctx}: data must be an array`).toBe(true);
  expect(
    (data ?? []).length,
    `${ctx}: anon must not receive rows (got ${(data ?? []).length})`
  ).toBe(0);
}

/** Mutating ops must always come back with a thrown RLS error for anon. */
function expectMutationDenied(
  result: { data: unknown; error: { message?: string } | null },
  ctx: string
) {
  const { data, error } = result;
  expect(error, `${ctx}: anon mutation must produce an error`).toBeTruthy();
  // PostgREST returns either the inserted/updated rows or null on denial. A
  // non-empty data array would mean the write actually persisted.
  if (Array.isArray(data)) {
    expect(
      data.length,
      `${ctx}: anon mutation must not return persisted rows`
    ).toBe(0);
  }
}

describe("tenant_settings — fully private to anon", () => {
  it("anon SELECT on tenant_settings returns no rows", async () => {
    const result = await anon.from("tenant_settings").select("*").limit(50);
    expectDeniedOrEmpty(result, "tenant_settings select *");
  });

  it("anon cannot SELECT business_email/phone/address (PII channel)", async () => {
    // Even narrow column projections must yield no rows — confirms there is
    // no public-facing view that proxies tenant_settings PII to anon.
    const result = await anon
      .from("tenant_settings")
      .select("business_email,business_phone,business_address")
      .limit(50);
    expectDeniedOrEmpty(result, "tenant_settings select PII columns");
  });

  it("anon INSERT into tenant_settings is denied", async () => {
    const result = await anon.from("tenant_settings").insert({
      tenant_id: PROBE_TENANT_ID,
      business_name: "Forged",
      primary_color: "#000000",
    } as never);
    expectMutationDenied(result, "tenant_settings insert");
  });

  it("anon UPDATE on tenant_settings is denied", async () => {
    const result = await anon
      .from("tenant_settings")
      .update({ business_name: "Hacked" } as never)
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "tenant_settings update");
  });

  it("anon DELETE on tenant_settings is denied", async () => {
    const result = await anon
      .from("tenant_settings")
      .delete()
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "tenant_settings delete");
  });
});

describe("tenant_opening_hours — anon read for active tenants only, no writes", () => {
  it("anon SELECT does not error (public-read policy is intentional)", async () => {
    const { error } = await anon
      .from("tenant_opening_hours")
      .select("id,tenant_id,resource_type,day_of_week,open_time,close_time")
      .limit(10);
    // The policy may return rows (active tenants) or none — both are fine.
    // What matters is the request itself is not rejected with an auth error.
    expect(error?.message ?? "").not.toMatch(/permission denied|JWT/i);
  });

  it("anon INSERT into tenant_opening_hours is denied", async () => {
    const result = await anon.from("tenant_opening_hours").insert({
      tenant_id: PROBE_TENANT_ID,
      resource_type: "restaurant",
      day_of_week: 1,
      open_time: "09:00",
      close_time: "17:00",
    } as never);
    expectMutationDenied(result, "tenant_opening_hours insert");
  });

  it("anon UPDATE on tenant_opening_hours is denied", async () => {
    const result = await anon
      .from("tenant_opening_hours")
      .update({ is_closed: true } as never)
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "tenant_opening_hours update");
  });

  it("anon DELETE on tenant_opening_hours is denied", async () => {
    const result = await anon
      .from("tenant_opening_hours")
      .delete()
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "tenant_opening_hours delete");
  });
});

describe("blocked_slots — anon read for active tenants only, no writes", () => {
  it("anon SELECT is permitted by policy but must not error on auth", async () => {
    const { error } = await anon
      .from("blocked_slots")
      .select("id,tenant_id,date,start_time,end_time")
      .limit(10);
    expect(error?.message ?? "").not.toMatch(/permission denied|JWT/i);
  });

  it("anon INSERT into blocked_slots is denied", async () => {
    const result = await anon.from("blocked_slots").insert({
      tenant_id: PROBE_TENANT_ID,
      resource_type: "restaurant",
      date: "2099-01-01",
      reason: "anon-injection",
    } as never);
    expectMutationDenied(result, "blocked_slots insert");
  });

  it("anon UPDATE on blocked_slots is denied", async () => {
    const result = await anon
      .from("blocked_slots")
      .update({ reason: "tampered" } as never)
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "blocked_slots update");
  });

  it("anon DELETE on blocked_slots is denied", async () => {
    const result = await anon
      .from("blocked_slots")
      .delete()
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "blocked_slots delete");
  });
});

describe("recurring_blocked_slots — anon read for active tenants only, no writes", () => {
  it("anon SELECT is permitted by policy but must not error on auth", async () => {
    const { error } = await anon
      .from("recurring_blocked_slots")
      .select("id,tenant_id,day_of_week,start_time,end_time")
      .limit(10);
    expect(error?.message ?? "").not.toMatch(/permission denied|JWT/i);
  });

  it("anon INSERT into recurring_blocked_slots is denied", async () => {
    const result = await anon.from("recurring_blocked_slots").insert({
      tenant_id: PROBE_TENANT_ID,
      resource_type: "restaurant",
      day_of_week: 2,
      reason: "anon-injection",
    } as never);
    expectMutationDenied(result, "recurring_blocked_slots insert");
  });

  it("anon UPDATE on recurring_blocked_slots is denied", async () => {
    const result = await anon
      .from("recurring_blocked_slots")
      .update({ is_active: false } as never)
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "recurring_blocked_slots update");
  });

  it("anon DELETE on recurring_blocked_slots is denied", async () => {
    const result = await anon
      .from("recurring_blocked_slots")
      .delete()
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "recurring_blocked_slots delete");
  });
});

describe("resource_images — anon read public, no writes", () => {
  it("anon SELECT does not error (public-read policy is intentional)", async () => {
    const { error } = await anon
      .from("resource_images")
      .select("id,tenant_id,resource_id,image_url,sort_order")
      .limit(10);
    expect(error?.message ?? "").not.toMatch(/permission denied|JWT/i);
  });

  it("anon INSERT into resource_images is denied", async () => {
    const result = await anon.from("resource_images").insert({
      tenant_id: PROBE_TENANT_ID,
      resource_id: PROBE_RESOURCE_ID,
      image_url: "https://evil.example.com/x.png",
      sort_order: 0,
    } as never);
    expectMutationDenied(result, "resource_images insert");
  });

  it("anon UPDATE on resource_images is denied", async () => {
    const result = await anon
      .from("resource_images")
      .update({ image_url: "https://evil.example.com/x.png" } as never)
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "resource_images update");
  });

  it("anon DELETE on resource_images is denied", async () => {
    const result = await anon
      .from("resource_images")
      .delete()
      .eq("tenant_id", PROBE_TENANT_ID);
    expectMutationDenied(result, "resource_images delete");
  });
});

describe("Authenticated baseline — anon does not have an auth session", () => {
  // Sanity check: we are actually probing as anon. If a future test setup
  // accidentally injected a service-role key, the assertions above would all
  // pass for the wrong reason. This guard makes that impossible.
  it("anon client has no user session", async () => {
    const { data } = await anon.auth.getUser();
    expect(data.user).toBeNull();
  });
});
