/**
 * Regression: anonymous users must never receive the `note` column from
 * `public.resource_availability_slots`.
 *
 * The `resource_availability_slots_anon_no_tenant_filter` hardening
 * revoked table-level SELECT from `anon` and re-granted it only on the
 * neutral scheduling columns. This test locks that invariant:
 *
 *   • A row inserted via service_role with a distinctive `note` value
 *     is readable anonymously on the neutral columns only.
 *   • Explicitly requesting `note` (or `*`) as anon must fail — never
 *     return the note payload.
 *   • The masked projection still exposes the columns callers legitimately
 *     depend on (id, tenant_id, resource_id, slot_date, start_time,
 *     end_time), so the fix didn't break public availability lookups.
 *
 * Runs only under the live workflow — needs a real anon key + service
 * role for setup/teardown.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY);

const NOTE_MARKER = `INTERNAL-NOTE-${randomUUID()}`;

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

interface Ctx {
  service: SupabaseClient;
  ownerId: string;
  tenantId: string;
  resourceId: string;
  slotId: string;
  cleanupTenants: string[];
  cleanupUsers: string[];
}

const ctx: Ctx = {
  service: null as unknown as SupabaseClient,
  ownerId: "",
  tenantId: "",
  resourceId: "",
  slotId: "",
  cleanupTenants: [],
  cleanupUsers: [],
};

describe.runIf(canRun)("resource_availability_slots.note anon-hidden (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();

    const email = `ci+ras-${randomUUID().slice(0, 8)}@mimmobook.test`;
    const password = `Ci-Ras-${randomUUID()}-Z9!`;
    const { data: userRes, error: userErr } = await ctx.service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userErr || !userRes.user) throw userErr ?? new Error("createUser failed");
    ctx.ownerId = userRes.user.id;
    ctx.cleanupUsers.push(ctx.ownerId);

    const tenantId = randomUUID();
    const shortId = tenantId.slice(0, 8);
    const { error: tErr } = await ctx.service.from("tenants").insert({
      id: tenantId,
      name: `TEST CI ras ${shortId}`,
      slug: `ci-ras-${shortId}`,
      tier: "professional",
      allowed_reservation_types: ["restaurant"],
      owner_user_id: ctx.ownerId,
      subscription_status: "trialing",
      is_active: true,
    });
    if (tErr) throw tErr;
    ctx.tenantId = tenantId;
    ctx.cleanupTenants.push(tenantId);

    await ctx.service.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: ctx.ownerId,
      role: "owner",
      is_approved: true,
    });

    const { data: resource, error: rErr } = await ctx.service
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI ras resource ${shortId}`,
        resource_type: "restaurant",
        is_active: true,
      })
      .select("id")
      .single();
    if (rErr || !resource) throw rErr ?? new Error("resource insert failed");
    ctx.resourceId = resource.id;

    const slotDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: slot, error: sErr } = await ctx.service
      .from("resource_availability_slots")
      .insert({
        tenant_id: tenantId,
        resource_id: ctx.resourceId,
        slot_date: slotDate,
        start_time: "10:00",
        end_time: "12:00",
        note: NOTE_MARKER,
      })
      .select("id")
      .single();
    if (sErr || !slot) throw sErr ?? new Error("slot insert failed");
    ctx.slotId = slot.id;
  }, 60_000);

  afterAll(async () => {
    if (!ctx.service) return;
    const swallow = async (p: PromiseLike<unknown>) => {
      try { await p; } catch { /* best-effort */ }
    };
    for (const t of ctx.cleanupTenants) {
      await swallow(ctx.service.from("resource_availability_slots").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("resources").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenants").delete().eq("id", t));
    }
    for (const u of ctx.cleanupUsers) {
      await swallow(ctx.service.auth.admin.deleteUser(u));
    }
  }, 60_000);

  it("anon SELECT * must not return the note column value", async () => {
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_availability_slots")
      .select("*")
      .eq("id", ctx.slotId);

    // Either PostgREST rejects the missing column privilege (error) or
    // returns rows that do not contain the note payload.
    if (error) {
      // Denial path — nothing further to check on this call.
      return;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    for (const row of rows) {
      expect(row.note, "note column must not be readable by anon").toBeUndefined();
      // Belt & suspenders: the marker value must not appear anywhere in the row.
      const serialized = JSON.stringify(row);
      expect(
        serialized.includes(NOTE_MARKER),
        "note marker string must not leak into any anon-visible field",
      ).toBe(false);
    }
  });

  it("anon explicit SELECT of the note column is denied", async () => {
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_availability_slots")
      .select("id, note")
      .eq("id", ctx.slotId);

    // The correct posture is a permission error. If Postgres/PostgREST
    // ever silently drops the column instead, ensure the marker is not
    // present in the returned rows.
    if (!error) {
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      for (const row of rows) {
        expect(row.note, "explicit note projection must be denied").toBeUndefined();
      }
      // Failing the assertion below documents the regression: if the
      // grant matrix is widened, the test forces someone to re-evaluate
      // whether that widening is intentional.
      expect(
        error,
        "anon selecting the note column should raise a permission error",
      ).not.toBeNull();
      return;
    }
    expect(error).toBeTruthy();
  });

  it("anon can still read neutral scheduling columns (regression: don't over-block)", async () => {
    const anon = newAnon();
    const { data, error } = await anon
      .from("resource_availability_slots")
      .select("id, tenant_id, resource_id, slot_date, start_time, end_time")
      .eq("id", ctx.slotId)
      .maybeSingle();

    expect(error, `neutral columns must remain readable: ${error?.message}`).toBeNull();
    expect(data?.id).toBe(ctx.slotId);
    expect(data?.tenant_id).toBe(ctx.tenantId);
    expect(data?.resource_id).toBe(ctx.resourceId);
  });
});
