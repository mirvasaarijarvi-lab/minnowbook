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

  it("server-side pricing persists byte-for-byte when the allowlist matches", async () => {
    // A real promo code so discount_code_id survives the sanitiser's
    // cross-tenant / dangling-reference checks.
    const code = `CIALLOW${randomUUID().slice(0, 6).toUpperCase()}`;
    const { data: codeRow, error: codeErr } = await ctx.service
      .from("discount_codes")
      .insert({
        tenant_id: ctx.tenantId,
        code,
        discount_type: "percentage",
        discount_value: 33,
        is_active: true,
        used_count: 0,
      })
      .select("id")
      .single();
    expect(codeErr, codeErr?.message).toBeNull();
    const codeId = codeRow!.id as string;

    // 3 nights x 89.90 with -33% => 269.70 gross, 180.70 final (cent rounding).
    const payload = {
      ...buildBase(`TEST CI allowlist exact ${randomUUID().slice(0, 8)}`),
      check_out_date: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
      original_price_eur: 269.7,
      price_eur: 180.7,
      pricing_details: "3 x 89.90 EUR, -33% (server-side)",
      discount_type: "percentage",
      discount_value: 33,
      discount_reason: `Promo code: ${code}`,
      discount_code_id: codeId,
      pricing_type: "fixed_price",
      breakfast_price_per_person: 12.5,
      stall_fee: 0,
      internal_notes: "edge function: public-booking",
      staff_notes: "no allergies reported",
      is_invoiced: true,
      is_checked_in: true,
      staff_needed: true,
      status: "confirmed",
      created_by: ctx.ownerId,
    };

    const { data: inserted, error } = await ctx.service
      .from("reservations")
      .insert(payload)
      .select("id")
      .single();
    expect(error, `service insert must succeed: ${error?.message}`).toBeNull();
    const id = inserted!.id as string;

    // Re-read from the database: the sanitiser trigger must not have rewritten
    // any of the trusted values.
    const { data: stored, error: readErr } = await ctx.service
      .from("reservations")
      .select(
        "price_eur, original_price_eur, pricing_details, pricing_type, discount_type, discount_value, discount_reason, discount_code_id, breakfast_price_per_person, stall_fee, internal_notes, staff_notes, is_invoiced, is_checked_in, staff_needed, status, created_by",
      )
      .eq("id", id)
      .single();
    expect(readErr, readErr?.message).toBeNull();

    expect(Number(stored!.price_eur)).toBe(180.7);
    expect(Number(stored!.original_price_eur)).toBe(269.7);
    expect(stored!.pricing_details).toBe(payload.pricing_details);
    expect(stored!.pricing_type).toBe("fixed_price");
    expect(stored!.discount_type).toBe("percentage");
    expect(Number(stored!.discount_value)).toBe(33);
    expect(stored!.discount_reason).toBe(payload.discount_reason);
    expect(stored!.discount_code_id).toBe(codeId);
    expect(Number(stored!.breakfast_price_per_person)).toBe(12.5);
    expect(Number(stored!.stall_fee)).toBe(0);
    expect(stored!.internal_notes).toBe(payload.internal_notes);
    expect(stored!.staff_notes).toBe(payload.staff_notes);
    expect(stored!.is_invoiced).toBe(true);
    expect(stored!.is_checked_in).toBe(true);
    expect(stored!.staff_needed).toBe(true);
    expect(stored!.status).toBe("confirmed");
    expect(stored!.created_by).toBe(ctx.ownerId);

    // The gross amount must stay above the charged amount, and the audit trail
    // must report the pricing fields as kept, not scrubbed.
    expect(Number(stored!.original_price_eur)).toBeGreaterThan(Number(stored!.price_eur));

    const { data: audit, error: auditErr } = await ctx.service
      .from("audit_log")
      .select("new_data")
      .eq("tenant_id", ctx.tenantId)
      .eq("action", "pricing_trust_decision")
      .eq("record_id", id);
    expect(auditErr, auditErr?.message).toBeNull();
    expect(audit ?? []).toHaveLength(1);
    const decision = (audit ?? [])[0]?.new_data as {
      trusted?: boolean;
      kept_fields?: string[];
      scrubbed_fields?: string[];
    } | null;
    expect(decision?.trusted).toBe(true);
    expect(decision?.scrubbed_fields).toEqual([]);
    expect(decision?.kept_fields).toContain("price_eur");
    expect(decision?.kept_fields).toContain("discount_code_id");

    await ctx.service.from("reservations").delete().eq("id", id);
    await ctx.service.from("audit_log").delete().eq("record_id", id);
    await ctx.service.from("discount_codes").delete().eq("id", codeId);
  });

  it("a zero-cost trusted insert keeps an explicit 0 instead of dropping to null", async () => {
    const name = `TEST CI allowlist zero ${randomUUID().slice(0, 8)}`;
    const { data, error } = await ctx.service
      .from("reservations")
      .insert({
        ...buildBase(name),
        original_price_eur: 80,
        price_eur: 0,
        discount_type: "free",
        discount_value: 80,
        discount_reason: "Comp stay",
      })
      .select("id, price_eur, original_price_eur, discount_type, discount_value")
      .single();

    expect(error, error?.message).toBeNull();
    expect(Number(data!.price_eur)).toBe(0);
    expect(data!.price_eur).not.toBeNull();
    expect(Number(data!.original_price_eur)).toBe(80);
    expect(data!.discount_type).toBe("free");
    expect(Number(data!.discount_value)).toBe(80);
  });
});
