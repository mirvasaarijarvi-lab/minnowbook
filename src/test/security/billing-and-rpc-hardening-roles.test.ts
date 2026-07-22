/**
 * Role matrix live regression for the four billing/RPC hardening fixes.
 *
 * `billing-and-rpc-hardening.test.ts` covers owner + anon. This suite
 * extends coverage across the non-owner authenticated roles that could
 * plausibly try to bypass the invariants:
 *
 *   • admin       — tenant member with elevated privileges
 *   • staff       — tenant member with limited privileges
 *   • outsider    — authenticated user NOT a member of the tenant
 *   • anon        — no session at all (control, mirrored here for parity)
 *
 * For each role we verify:
 *
 *   1. copy_tenant_defaults_rpc — anon + outsider + staff MUST be
 *      rejected; admin MUST succeed on the legitimate tenant/site pair
 *      but be rejected on cross-tenant / mismatched-site payloads.
 *   2. create_tenant_free_tier — no role can create a tenant on a
 *      paid tier; caller-supplied `p_tier` is ignored across roles.
 *   3. tenants_tier_selfwrite — admin + staff + outsider + anon cannot
 *      change tier / Stripe / discount columns. Service role still can.
 *   4. reservations_anon_insert_discount_bypass — anon insert with any
 *      discount field is rejected; clean insert succeeds and stores
 *      NULL discount columns. Authenticated non-owners get no easier
 *      path than anon here (they must go through owner-only flows).
 *
 * Runs only when full live credentials (URL + anon + service role) are
 * available. Skips otherwise so PR/offline runs stay green.
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

interface Actor {
  userId: string;
  email: string;
  password: string;
}

interface Ctx {
  service: SupabaseClient;
  tenantId: string;
  siteId: string;
  otherTenantId: string;
  otherSiteId: string;
  owner: Actor;
  admin: Actor;
  staff: Actor;
  outsider: Actor;
  cleanupUsers: string[];
  cleanupTenants: string[];
}

const ctx: Ctx = {
  service: null as unknown as SupabaseClient,
  tenantId: "",
  siteId: "",
  otherTenantId: "",
  otherSiteId: "",
  owner: null as unknown as Actor,
  admin: null as unknown as Actor,
  staff: null as unknown as Actor,
  outsider: null as unknown as Actor,
  cleanupUsers: [],
  cleanupTenants: [],
};

async function createUser(service: SupabaseClient, label: string): Promise<Actor> {
  const email = `ci+roles-${label}-${randomUUID().slice(0, 8)}@mimmobook.test`;
  const password = `Ci-Roles-${randomUUID()}-Z9!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  ctx.cleanupUsers.push(data.user.id);
  return { userId: data.user.id, email, password };
}

async function createTenant(
  service: SupabaseClient,
  ownerUserId: string,
  label: string,
): Promise<{ tenantId: string; siteId: string }> {
  const tenantId = randomUUID();
  const shortId = tenantId.slice(0, 8);
  const { error } = await service.from("tenants").insert({
    id: tenantId,
    name: `TEST CI roles ${label} ${shortId}`,
    slug: `ci-roles-${label}-${shortId}`,
    tier: "basic",
    allowed_reservation_types: ["restaurant"],
    owner_user_id: ownerUserId,
    subscription_status: "trialing",
    is_active: true,
  });
  if (error) throw error;
  ctx.cleanupTenants.push(tenantId);

  const { error: tuErr } = await service.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: ownerUserId,
    role: "owner",
    is_approved: true,
  });
  if (tuErr) throw tuErr;

  const { data: site, error: siteErr } = await service
    .from("sites")
    .insert({
      tenant_id: tenantId,
      name: `roles-site-${label}`,
      slug: `site-${randomUUID().slice(0, 8)}`,
    })
    .select("id")
    .single();
  if (siteErr || !site) throw siteErr ?? new Error("site insert failed");

  return { tenantId, siteId: site.id };
}

async function addTenantMember(
  service: SupabaseClient,
  tenantId: string,
  userId: string,
  role: "admin" | "staff",
) {
  const { error } = await service.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: userId,
    role,
    is_approved: true,
  });
  if (error) throw error;
}

async function signedInClient(actor: Actor): Promise<SupabaseClient> {
  const client = newAnon();
  const { error } = await client.auth.signInWithPassword({
    email: actor.email,
    password: actor.password,
  });
  if (error) throw error;
  return client;
}

describe.runIf(canRun)("billing + RPC hardening — role matrix (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();

    ctx.owner = await createUser(ctx.service, "owner");
    ctx.admin = await createUser(ctx.service, "admin");
    ctx.staff = await createUser(ctx.service, "staff");
    ctx.outsider = await createUser(ctx.service, "outsider");

    const primary = await createTenant(ctx.service, ctx.owner.userId, "primary");
    ctx.tenantId = primary.tenantId;
    ctx.siteId = primary.siteId;

    await addTenantMember(ctx.service, ctx.tenantId, ctx.admin.userId, "admin");
    await addTenantMember(ctx.service, ctx.tenantId, ctx.staff.userId, "staff");

    // Second tenant to exercise cross-tenant paths.
    const otherOwner = await createUser(ctx.service, "otherowner");
    const other = await createTenant(ctx.service, otherOwner.userId, "other");
    ctx.otherTenantId = other.tenantId;
    ctx.otherSiteId = other.siteId;
  }, 90_000);

  afterAll(async () => {
    if (!ctx.service) return;
    const swallow = async (p: PromiseLike<unknown>) => {
      try { await p; } catch { /* best-effort */ }
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

  // ─── Fix 3: copy_tenant_defaults_to_site — role matrix ────────────
  describe("copy_tenant_defaults_to_site", () => {
    it("anon call is rejected", async () => {
      const anon = newAnon();
      const { error } = await anon.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.tenantId,
        p_site_id: ctx.siteId,
      });
      expect(error, "anon must be rejected").not.toBeNull();
    });

    it("outsider (non-member) is rejected", async () => {
      const client = await signedInClient(ctx.outsider);
      const { error } = await client.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.tenantId,
        p_site_id: ctx.siteId,
      });
      expect(error, "outsider must be rejected").not.toBeNull();
      await client.auth.signOut();
    });

    it("staff (member but not admin/owner) is rejected", async () => {
      const client = await signedInClient(ctx.staff);
      const { error } = await client.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.tenantId,
        p_site_id: ctx.siteId,
      });
      expect(error, "staff must be rejected").not.toBeNull();
      await client.auth.signOut();
    });

    it("admin succeeds on own tenant/site, rejected cross-tenant + mismatched site", async () => {
      const client = await signedInClient(ctx.admin);

      // Legitimate call (control): admin of tenantId targeting its own site.
      const { error: okErr } = await client.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.tenantId,
        p_site_id: ctx.siteId,
      });
      expect(okErr, "admin on own tenant should succeed").toBeNull();

      // Cross-tenant: admin of tenantId targeting otherTenantId.
      const { error: crossErr } = await client.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.otherTenantId,
        p_site_id: ctx.otherSiteId,
      });
      expect(crossErr, "cross-tenant must be rejected").not.toBeNull();

      // Mismatched site: own tenant but site from the other tenant.
      const { error: mismatchErr } = await client.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.tenantId,
        p_site_id: ctx.otherSiteId,
      });
      expect(mismatchErr, "site-not-in-tenant must be rejected").not.toBeNull();

      await client.auth.signOut();
    });
  });

  // ─── Fix 1: create_tenant free tier — role matrix ─────────────────
  describe("create_tenant p_tier is ignored", () => {
    it.each(["business", "professional"] as const)(
      "outsider requesting p_tier=%s still lands on basic",
      async (requestedTier) => {
        // Fresh user each iteration — create_tenant is scoped per caller.
        const actor = await createUser(ctx.service, `ct-${requestedTier}`);
        const client = await signedInClient(actor);
        const slug = `ci-roles-ct-${randomUUID().slice(0, 8)}`;
        const { data: tenantId, error } = await client.rpc("create_tenant", {
          p_name: `TEST CI roles ct ${requestedTier}`,
          p_slug: slug,
          p_tier: requestedTier,
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
      },
    );
  });

  // ─── Fix 2: tenants billing self-write — role matrix ──────────────
  describe("tenants billing columns are read-only for non-service-role", () => {
    const billingPatches: Array<Record<string, unknown>> = [
      { tier: "business" },
      { subscription_status: "active" },
      { stripe_customer_id: "cus_attacker" },
      { stripe_subscription_id: "sub_attacker" },
      { discount_percentage: 99 },
    ];

    it("anon cannot update billing columns", async () => {
      const anon = newAnon();
      for (const patch of billingPatches) {
        const { error } = await anon.from("tenants").update(patch).eq("id", ctx.tenantId);
        expect(error, `anon patch ${JSON.stringify(patch)} must be rejected`).not.toBeNull();
      }
    });

    it("outsider cannot update billing columns", async () => {
      const client = await signedInClient(ctx.outsider);
      for (const patch of billingPatches) {
        const { error, data } = await client
          .from("tenants")
          .update(patch)
          .eq("id", ctx.tenantId)
          .select("id");
        // Either an explicit error OR RLS filters the row out (empty result).
        const blocked = Boolean(error) || !data || data.length === 0;
        expect(blocked, `outsider patch ${JSON.stringify(patch)} must not apply`).toBe(true);
      }
      await client.auth.signOut();
    });

    it.each(["admin", "staff"] as const)("%s member cannot update billing columns", async (role) => {
      const actor = role === "admin" ? ctx.admin : ctx.staff;
      const client = await signedInClient(actor);
      for (const patch of billingPatches) {
        const { error } = await client.from("tenants").update(patch).eq("id", ctx.tenantId);
        expect(error, `${role} patch ${JSON.stringify(patch)} must be rejected`).not.toBeNull();
      }
      await client.auth.signOut();
    });

    it("post-condition: billing columns unchanged after all role attempts", async () => {
      const { data: row } = await ctx.service
        .from("tenants")
        .select("tier, subscription_status, stripe_customer_id, stripe_subscription_id, discount_percentage")
        .eq("id", ctx.tenantId)
        .single();
      expect(row?.tier).toBe("basic");
      expect(row?.subscription_status).toBe("trialing");
      expect(row?.stripe_customer_id).toBeNull();
      expect(row?.stripe_subscription_id).toBeNull();
      expect(row?.discount_percentage ?? 0).not.toBe(99);
    });
  });

  // ─── Fix 4: anonymous reservation discount bypass ─────────────────
  describe("reservations discount bypass", () => {
    const buildBase = () => ({
      tenant_id: ctx.tenantId,
      reservation_type: "restaurant",
      date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      guest_name: `TEST CI roles disc ${randomUUID().slice(0, 8)}`,
      guest_email: "ci-roles-disc@mimmobook.test",
      status: "pending",
    });

    const discountFields: Array<Record<string, unknown>> = [
      { discount_code_id: randomUUID() },
      { discount_type: "percent" },
      { discount_value: 50 },
      { discount_code_id: randomUUID(), discount_type: "fixed", discount_value: 25 },
    ];

    it("anon insert with any discount field is rejected", async () => {
      const anon = newAnon();
      for (const extra of discountFields) {
        const { error } = await anon.from("reservations").insert({ ...buildBase(), ...extra });
        expect(error, `anon insert with ${JSON.stringify(extra)} must fail`).not.toBeNull();
      }
    });

    it("anon clean insert stores NULL discount columns (control)", async () => {
      const anon = newAnon();
      const { data, error } = await anon
        .from("reservations")
        .insert(buildBase())
        .select("id, discount_code_id, discount_type, discount_value")
        .single();
      expect(error).toBeNull();
      expect(data?.discount_code_id).toBeNull();
      expect(data?.discount_type).toBeNull();
      expect(data?.discount_value).toBeNull();
    });

    it("outsider (authenticated non-member) insert with discount is also rejected", async () => {
      const client = await signedInClient(ctx.outsider);
      for (const extra of discountFields) {
        const { error } = await client.from("reservations").insert({ ...buildBase(), ...extra });
        expect(error, `outsider insert with ${JSON.stringify(extra)} must fail`).not.toBeNull();
      }
      await client.auth.signOut();
    });
  });

  // ─── service_role positive path — bypasses RLS, exercises trusted writes ──
  //
  // These assertions pin the invariant that the hardening migration only
  // clamps down on anon + authenticated roles. The Lovable Cloud backend
  // (edge functions, Stripe webhooks, admin jobs) still needs the
  // service_role to perform legitimate billing writes and tenant setup.
  // If a future migration accidentally revokes those grants, the app
  // breaks silently in production — these tests catch that regression.
  describe("service_role retains permitted writes", () => {
    it("service_role can update billing columns that anon/members cannot", async () => {
      const patch = {
        tier: "professional" as const,
        subscription_status: "active",
        stripe_customer_id: `cus_service_${randomUUID().slice(0, 8)}`,
        stripe_subscription_id: `sub_service_${randomUUID().slice(0, 8)}`,
        discount_percentage: 15,
      };
      const { error } = await ctx.service
        .from("tenants")
        .update(patch)
        .eq("id", ctx.tenantId);
      expect(error, "service_role billing update must succeed").toBeNull();

      const { data: row } = await ctx.service
        .from("tenants")
        .select("tier, subscription_status, stripe_customer_id, stripe_subscription_id, discount_percentage")
        .eq("id", ctx.tenantId)
        .single();
      expect(row?.tier).toBe("professional");
      expect(row?.subscription_status).toBe("active");
      expect(row?.stripe_customer_id).toBe(patch.stripe_customer_id);
      expect(row?.stripe_subscription_id).toBe(patch.stripe_subscription_id);
      expect(Number(row?.discount_percentage)).toBe(15);

      // Reset so downstream assertions/cleanup stay deterministic.
      const { error: resetErr } = await ctx.service
        .from("tenants")
        .update({
          tier: "basic",
          subscription_status: "trialing",
          stripe_customer_id: null,
          stripe_subscription_id: null,
          discount_percentage: 0,
        })
        .eq("id", ctx.tenantId);
      expect(resetErr).toBeNull();
    });

    it("service_role can invoke copy_tenant_defaults_to_site cross-tenant", async () => {
      // Trusted server code (edge functions running as service_role) must be
      // able to seed defaults for ANY tenant/site pair — the admin-only
      // guard inside the SECURITY DEFINER function only applies to the
      // authenticated caller path, not to service_role callers.
      const { error } = await ctx.service.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.otherTenantId,
        p_site_id: ctx.otherSiteId,
      });
      expect(error, "service_role cross-tenant copy must succeed").toBeNull();
    });

    it("service_role can insert reservations with discount fields (anon cannot)", async () => {
      const row = {
        tenant_id: ctx.tenantId,
        reservation_type: "restaurant",
        date: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
        guest_name: `TEST CI roles svc-disc ${randomUUID().slice(0, 8)}`,
        guest_email: "ci-roles-svc-disc@mimmobook.test",
        status: "pending",
        discount_type: "percent",
        discount_value: 10,
      };
      const { data, error } = await ctx.service
        .from("reservations")
        .insert(row)
        .select("id, discount_type, discount_value")
        .single();
      expect(error, "service_role discount insert must succeed").toBeNull();
      expect(data?.discount_type).toBe("percent");
      expect(Number(data?.discount_value)).toBe(10);
    });

    it("negative control: anon + outsider remain blocked on the same operations", async () => {
      // Mirrors the positive assertions above with the roles that MUST
      // stay blocked, so the matrix is unambiguous at review time.
      const anon = newAnon();
      const { error: anonBillingErr } = await anon
        .from("tenants")
        .update({ tier: "business" })
        .eq("id", ctx.tenantId);
      expect(anonBillingErr, "anon billing update stays blocked").not.toBeNull();

      const { error: anonRpcErr } = await anon.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.tenantId,
        p_site_id: ctx.siteId,
      });
      expect(anonRpcErr, "anon copy_tenant_defaults_to_site stays blocked").not.toBeNull();

      const outsider = await signedInClient(ctx.outsider);
      const { error: outsiderRpcErr } = await outsider.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: ctx.tenantId,
        p_site_id: ctx.siteId,
      });
      expect(outsiderRpcErr, "outsider copy_tenant_defaults_to_site stays blocked").not.toBeNull();

      const { error: outsiderResvErr } = await outsider.from("reservations").insert({
        tenant_id: ctx.tenantId,
        reservation_type: "restaurant",
        date: new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10),
        guest_name: `TEST CI roles neg-ctrl ${randomUUID().slice(0, 8)}`,
        guest_email: "ci-roles-neg-ctrl@mimmobook.test",
        status: "pending",
        discount_type: "percent",
        discount_value: 10,
      });
      expect(outsiderResvErr, "outsider discount insert stays blocked").not.toBeNull();
      await outsider.auth.signOut();
    });
  });
});
