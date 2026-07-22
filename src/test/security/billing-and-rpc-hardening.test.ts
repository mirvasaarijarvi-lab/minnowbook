/**
 * Live regression suite for the four billing/RPC hardening fixes:
 *
 *   1. `create_tenant` MUST always seed new tenants at `basic` tier,
 *      even when the caller supplies `p_tier = 'business'`.
 *   2. Direct UPDATE on `public.tenants` MUST NOT allow a tenant owner
 *      (authenticated role) to change billing columns (`tier`,
 *      `subscription_status`, `stripe_customer_id`,
 *      `stripe_subscription_id`, `discount_percentage`, etc.). The
 *      service role must still be able to change them (Stripe sync).
 *   3. `copy_tenant_defaults_to_site(p_tenant_id, p_site_id)` MUST
 *      refuse when the caller is not a member/owner of `p_tenant_id`,
 *      and when `p_site_id` does not belong to `p_tenant_id`.
 *   4. Anonymous inserts into `public.reservations` MUST NOT be able
 *      to attach `discount_code_id`, `discount_type`, or
 *      `discount_value` — the public INSERT policy has to force
 *      them to NULL.
 *
 * Runs only when live Supabase credentials + service role key are
 * available (scheduled + manual live workflow). Skips locally so PR
 * checks stay fast/offline.
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
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY);

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
  tenantId: string;
  ownerId: string;
  ownerEmail: string;
  ownerPassword: string;
  siteId: string;
  otherTenantId: string;
  otherOwnerId: string;
  cleanupUsers: string[];
  cleanupTenants: string[];
}

const ctx: Ctx = {
  service: null as unknown as SupabaseClient,
  tenantId: "",
  ownerId: "",
  ownerEmail: "",
  ownerPassword: "",
  siteId: "",
  otherTenantId: "",
  otherOwnerId: "",
  cleanupUsers: [],
  cleanupTenants: [],
};

async function createOwner(service: SupabaseClient, label: string) {
  const email = `ci+${label}-${randomUUID().slice(0, 8)}@mimmobook.test`;
  const password = `Ci-Tmp-${randomUUID()}-Z9!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  ctx.cleanupUsers.push(data.user.id);
  return { userId: data.user.id, email, password };
}

async function createTenant(service: SupabaseClient, ownerUserId: string, label: string) {
  const id = randomUUID();
  const shortId = id.slice(0, 8);
  const slug = `ci-billing-${label}-${shortId}`;
  const name = `TEST CI billing ${label} ${shortId}`;
  const { error } = await service.from("tenants").insert({
    id,
    name,
    slug,
    tier: "basic",
    allowed_reservation_types: ["restaurant"],
    owner_user_id: ownerUserId,
    subscription_status: "trialing",
    is_active: true,
  });
  if (error) throw error;
  ctx.cleanupTenants.push(id);
  const { error: tue } = await service.from("tenant_users").insert({
    tenant_id: id,
    user_id: ownerUserId,
    role: "owner",
    is_approved: true,
  });
  if (tue) throw tue;
  return id;
}

describe.runIf(canRun)("billing + RPC hardening (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();
    const owner = await createOwner(ctx.service, "owner");
    ctx.ownerId = owner.userId;
    ctx.ownerEmail = owner.email;
    ctx.ownerPassword = owner.password;
    ctx.tenantId = await createTenant(ctx.service, ctx.ownerId, "primary");

    const { data: siteRow, error: siteErr } = await ctx.service
      .from("sites")
      .insert({ tenant_id: ctx.tenantId, name: "primary-site", slug: `site-${randomUUID().slice(0, 8)}` })
      .select("id")
      .single();
    if (siteErr || !siteRow) throw siteErr ?? new Error("site insert failed");
    ctx.siteId = siteRow.id;

    const other = await createOwner(ctx.service, "other");
    ctx.otherOwnerId = other.userId;
    ctx.otherTenantId = await createTenant(ctx.service, ctx.otherOwnerId, "other");
  }, 60_000);

  afterAll(async () => {
    if (!ctx.service) return;
    const swallow = async (p: PromiseLike<unknown>) => {
      try { await p; } catch { /* best-effort cleanup */ }
    };
    for (const t of ctx.cleanupTenants) {
      await swallow(ctx.service.from("reservations").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("sites").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenants").delete().eq("id", t));
    }
    for (const u of ctx.cleanupUsers) {
      await swallow(ctx.service.auth.admin.deleteUser(u));
    }
  }, 60_000);

  // ─── Fix 1: create_tenant free-tier ────────────────────────────────
  it("create_tenant ignores caller-supplied p_tier and always seeds basic", async () => {
    // Sign in as a brand-new user with no tenant yet.
    const fresh = await createOwner(ctx.service, "createtenant");
    const client = newAnon();
    const { error: signInErr } = await client.auth.signInWithPassword({
      email: fresh.email,
      password: fresh.password,
    });
    expect(signInErr).toBeNull();

    const slug = `ci-ct-${randomUUID().slice(0, 8)}`;
    const { data: tenantId, error } = await client.rpc("create_tenant", {
      p_name: "Attacker Tenant",
      p_slug: slug,
      p_tier: "business",
      p_allowed_reservation_types: ["restaurant"],
    });
    expect(error).toBeNull();
    expect(typeof tenantId).toBe("string");
    ctx.cleanupTenants.push(tenantId as string);

    const { data: row } = await ctx.service
      .from("tenants")
      .select("tier")
      .eq("id", tenantId as string)
      .single();
    expect(row?.tier).toBe("basic");
    await client.auth.signOut();
  });

  // ─── Fix 2: tenants billing self-write ─────────────────────────────
  it("owner cannot self-upgrade tier or write Stripe/discount fields", async () => {
    const client = newAnon();
    const { error: signInErr } = await client.auth.signInWithPassword({
      email: ctx.ownerEmail,
      password: ctx.ownerPassword,
    });
    expect(signInErr).toBeNull();

    const attempts: Array<Record<string, unknown>> = [
      { tier: "business" },
      { subscription_status: "active" },
      { stripe_customer_id: "cus_attacker" },
      { stripe_subscription_id: "sub_attacker" },
      { discount_percentage: 99 },
    ];
    for (const patch of attempts) {
      const { error } = await client.from("tenants").update(patch).eq("id", ctx.tenantId);
      expect(error, `expected update ${JSON.stringify(patch)} to be rejected`).not.toBeNull();
    }

    const { data: row } = await ctx.service
      .from("tenants")
      .select("tier, subscription_status, stripe_customer_id, stripe_subscription_id, discount_percentage")
      .eq("id", ctx.tenantId)
      .single();
    expect(row?.tier).toBe("basic");
    expect(row?.subscription_status).toBe("trialing");
    expect(row?.stripe_customer_id).toBeNull();
    expect(row?.stripe_subscription_id).toBeNull();
    // discount_percentage default is 0 or NULL depending on schema; must NOT be 99.
    expect(row?.discount_percentage ?? 0).not.toBe(99);

    // Owners can still change non-billing columns (control).
    const { error: nonBillingErr } = await client
      .from("tenants")
      .update({ name: "renamed-by-owner" })
      .eq("id", ctx.tenantId);
    expect(nonBillingErr).toBeNull();

    // Service role can still change billing (Stripe sync path).
    const { error: syncErr } = await ctx.service
      .from("tenants")
      .update({ subscription_status: "trialing", stripe_customer_id: null })
      .eq("id", ctx.tenantId);
    expect(syncErr).toBeNull();

    await client.auth.signOut();
  });

  // ─── Fix 3: copy_tenant_defaults_to_site authorization ─────────────
  it("copy_tenant_defaults_to_site rejects non-members and mismatched site", async () => {
    const client = newAnon();
    const { error: signInErr } = await client.auth.signInWithPassword({
      email: ctx.ownerEmail,
      password: ctx.ownerPassword,
    });
    expect(signInErr).toBeNull();

    // Cross-tenant: owner of tenantId targeting otherTenantId.
    const { error: crossErr } = await client.rpc("copy_tenant_defaults_to_site", {
      p_tenant_id: ctx.otherTenantId,
      p_site_id: ctx.siteId,
    });
    expect(crossErr, "cross-tenant call must be rejected").not.toBeNull();

    // Mismatched site: legitimate tenant but a site that belongs to another tenant.
    const { error: mismatchErr } = await client.rpc("copy_tenant_defaults_to_site", {
      p_tenant_id: ctx.tenantId,
      p_site_id: randomUUID(),
    });
    expect(mismatchErr, "site-not-in-tenant must be rejected").not.toBeNull();

    await client.auth.signOut();
  });

  // ─── Fix 4: anon reservation insert cannot attach discounts ────────
  it("anonymous reservation insert cannot attach discount fields", async () => {
    const anon = newAnon();
    const base = {
      tenant_id: ctx.tenantId,
      reservation_type: "restaurant",
      date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      guest_name: `TEST CI discount ${randomUUID().slice(0, 8)}`,
      guest_email: "ci-discount@mimmobook.test",
      status: "pending",
    };

    const discountAttempts: Array<Record<string, unknown>> = [
      { discount_code_id: randomUUID() },
      { discount_type: "percent" },
      { discount_value: 50 },
    ];
    for (const extra of discountAttempts) {
      const { error } = await anon.from("reservations").insert({ ...base, ...extra });
      expect(error, `anon insert with ${JSON.stringify(extra)} must be rejected`).not.toBeNull();
    }

    // Control: same payload without discount fields is allowed.
    const { data: ok, error: okErr } = await anon
      .from("reservations")
      .insert(base)
      .select("id, discount_code_id, discount_type, discount_value")
      .single();
    expect(okErr).toBeNull();
    expect(ok?.discount_code_id).toBeNull();
    expect(ok?.discount_type).toBeNull();
    expect(ok?.discount_value).toBeNull();
  });
});
