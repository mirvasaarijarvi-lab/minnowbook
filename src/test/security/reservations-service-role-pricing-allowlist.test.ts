/**
 * Regression: the reservations BEFORE INSERT trigger has an explicit
 * trusted-context allowlist. Inserts made with the service role (the
 * `public-booking` edge function computes canonical pricing server-side)
 * must keep pricing, discount metadata and staff-owned columns intact,
 * while anonymous inserts stay fully scrubbed.
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

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const ctx = {
  service: null as unknown as SupabaseClient,
  ownerId: "",
  tenantId: "",
};

const buildBase = (name: string) => ({
  tenant_id: ctx.tenantId,
  reservation_type: "restaurant",
  date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  guest_name: name,
  guest_email: "ci-allowlist@mimmobook.test",
  status: "pending",
});

describe.runIf(canRun)("reservations insert trigger — service_role pricing allowlist (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();
    const email = `ci+allow-${randomUUID().slice(0, 8)}@mimmobook.test`;
    const { data: userRes, error: userErr } = await ctx.service.auth.admin.createUser({
      email,
      password: `Ci-Allow-${randomUUID()}-Z9!`,
      email_confirm: true,
    });
    if (userErr || !userRes.user) throw userErr ?? new Error("createUser failed");
    ctx.ownerId = userRes.user.id;

    const tenantId = randomUUID();
    const shortId = tenantId.slice(0, 8);
    const { error: tErr } = await ctx.service.from("tenants").insert({
      id: tenantId,
      name: `TEST CI allowlist ${shortId}`,
      slug: `ci-allowlist-${shortId}`,
      tier: "basic",
      allowed_reservation_types: ["restaurant"],
      owner_user_id: ctx.ownerId,
      subscription_status: "trialing",
      is_active: true,
    });
    if (tErr) throw tErr;
    ctx.tenantId = tenantId;
  }, 60_000);

  afterAll(async () => {
    if (!ctx.service || !ctx.tenantId) return;
    const swallow = async (p: PromiseLike<unknown>) => {
      try { await p; } catch { /* best-effort */ }
    };
    await swallow(ctx.service.from("reservations").delete().eq("tenant_id", ctx.tenantId));
    await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", ctx.tenantId));
    await swallow(ctx.service.from("tenants").delete().eq("id", ctx.tenantId));
    if (ctx.ownerId) await swallow(ctx.service.auth.admin.deleteUser(ctx.ownerId));
  }, 60_000);

  it("service role keeps server-computed pricing, discount and staff fields", async () => {
    const name = `TEST CI allowlist svc ${randomUUID().slice(0, 8)}`;
    const { data, error } = await ctx.service
      .from("reservations")
      .insert({
        ...buildBase(name),
        price_eur: 90,
        original_price_eur: 120,
        pricing_details: "2 nights x 60 EUR, 25% code",
        discount_type: "percentage",
        discount_value: 25,
        discount_reason: "Code CI25",
        internal_notes: "server-side booking",
        is_invoiced: false,
      })
      .select(
        "id, price_eur, original_price_eur, pricing_details, discount_type, discount_value, discount_reason, internal_notes, status",
      )
      .single();

    expect(error, `service insert must succeed: ${error?.message}`).toBeNull();
    expect(data).toBeTruthy();
    if (!data) return;
    expect(Number(data.price_eur)).toBe(90);
    expect(Number(data.original_price_eur)).toBe(120);
    expect(data.pricing_details).toContain("60 EUR");
    expect(data.discount_type).toBe("percentage");
    expect(Number(data.discount_value)).toBe(25);
    expect(data.discount_reason).toBe("Code CI25");
    expect(data.internal_notes).toBe("server-side booking");
    expect(data.status).toBe("pending");
  });

  it("anon inserts are still scrubbed of pricing", async () => {
    const anon = newAnon();
    const name = `TEST CI allowlist anon ${randomUUID().slice(0, 8)}`;
    const { error } = await anon
      .from("reservations")
      .insert({ ...buildBase(name), price_eur: 0.01, discount_value: 99 });

    if (!error) {
      const { data } = await ctx.service
        .from("reservations")
        .select("price_eur, discount_value")
        .eq("tenant_id", ctx.tenantId)
        .eq("guest_name", name)
        .single();
      expect(data?.price_eur).toBeNull();
      expect(data?.discount_value).toBeNull();
    } else {
      expect(error.message).toBeTruthy();
    }
  });
});
