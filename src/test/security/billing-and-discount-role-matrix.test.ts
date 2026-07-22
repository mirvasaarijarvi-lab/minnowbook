/**
 * Role-matrix regression for billing + discount mutations.
 *
 * Complements `billing-and-rpc-hardening-roles.test.ts` by focusing on the
 * intent per role — what each authenticated tenant role should and should
 * not be able to do — so the matrix is documented in one place and every
 * cell is asserted directly.
 *
 * Matrix under test (public.tenants billing + public.discount_codes CRUD):
 *
 *   ┌──────────────┬──────────────────────────┬────────────────────────────┐
 *   │ role         │ tenants billing update   │ discount_codes CRUD        │
 *   ├──────────────┼──────────────────────────┼────────────────────────────┤
 *   │ anon         │ DENY                     │ DENY (all ops)             │
 *   │ outsider     │ DENY                     │ DENY (all ops)             │
 *   │ staff        │ DENY                     │ SELECT ok, write DENY      │
 *   │ admin        │ DENY (blocked by trigger)│ ALLOW (insert/update/del)  │
 *   │ owner        │ DENY (blocked by trigger)│ ALLOW (insert/update/del)  │
 *   │ service_role │ ALLOW                    │ ALLOW                      │
 *   └──────────────┴──────────────────────────┴────────────────────────────┘
 *
 * "Billing columns" == the set the `tenants_tier_selfwrite` guard blocks:
 *   tier, subscription_status, stripe_customer_id, stripe_subscription_id,
 *   discount_percentage. Non-billing columns (e.g. name) remain writable
 *   for owner/admin per the "Owners can update their tenant" policy, so we
 *   assert a positive control on that path as well.
 *
 * Skips cleanly when live Supabase creds are unavailable (fork PRs).
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

const BILLING_PATCHES: ReadonlyArray<Record<string, unknown>> = [
  { tier: "business" },
  { subscription_status: "active" },
  { stripe_customer_id: "cus_matrix_attacker" },
  { stripe_subscription_id: "sub_matrix_attacker" },
  { discount_percentage: 42 },
];

type Role = "owner" | "admin" | "staff" | "outsider" | "anon";

interface Actor {
  userId: string;
  email: string;
  password: string;
}

interface Ctx {
  service: SupabaseClient;
  tenantId: string;
  owner: Actor;
  admin: Actor;
  staff: Actor;
  outsider: Actor;
  seededDiscountId: string;
  cleanupUsers: string[];
  cleanupTenants: string[];
  cleanupDiscounts: string[];
}

const ctx: Ctx = {
  service: null as unknown as SupabaseClient,
  tenantId: "",
  owner: null as unknown as Actor,
  admin: null as unknown as Actor,
  staff: null as unknown as Actor,
  outsider: null as unknown as Actor,
  seededDiscountId: "",
  cleanupUsers: [],
  cleanupTenants: [],
  cleanupDiscounts: [],
};

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function createUser(label: string): Promise<Actor> {
  const email = `ci+billmatrix-${label}-${randomUUID().slice(0, 8)}@mimmobook.test`;
  const password = `Ci-Matrix-${randomUUID()}-Z9!`;
  const { data, error } = await ctx.service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  ctx.cleanupUsers.push(data.user.id);
  return { userId: data.user.id, email, password };
}

async function signedInClient(actor: Actor | null): Promise<SupabaseClient> {
  const client = newAnon();
  if (actor) {
    const { error } = await client.auth.signInWithPassword({
      email: actor.email,
      password: actor.password,
    });
    if (error) throw error;
  }
  return client;
}

async function clientFor(role: Role): Promise<SupabaseClient> {
  switch (role) {
    case "owner": return signedInClient(ctx.owner);
    case "admin": return signedInClient(ctx.admin);
    case "staff": return signedInClient(ctx.staff);
    case "outsider": return signedInClient(ctx.outsider);
    case "anon": return newAnon();
  }
}

/** True when the mutation was effectively blocked (explicit error or no rows). */
function mutationBlocked(error: unknown, data: unknown[] | null | undefined): boolean {
  return Boolean(error) || !data || data.length === 0;
}

describe.runIf(canRun)("billing + discount mutations — role matrix (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();

    ctx.owner = await createUser("owner");
    ctx.admin = await createUser("admin");
    ctx.staff = await createUser("staff");
    ctx.outsider = await createUser("outsider");

    const tenantId = randomUUID();
    const shortId = tenantId.slice(0, 8);
    const { error: tErr } = await ctx.service.from("tenants").insert({
      id: tenantId,
      name: `TEST CI matrix ${shortId}`,
      slug: `ci-matrix-${shortId}`,
      tier: "basic",
      allowed_reservation_types: ["restaurant"],
      owner_user_id: ctx.owner.userId,
      subscription_status: "trialing",
      is_active: true,
    });
    if (tErr) throw tErr;
    ctx.tenantId = tenantId;
    ctx.cleanupTenants.push(tenantId);

    // Memberships.
    const memberships = [
      { user_id: ctx.owner.userId, role: "owner" as const },
      { user_id: ctx.admin.userId, role: "admin" as const },
      { user_id: ctx.staff.userId, role: "staff" as const },
    ];
    for (const m of memberships) {
      const { error } = await ctx.service.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: m.user_id,
        role: m.role,
        is_approved: true,
      });
      if (error) throw error;
    }

    // Seed one discount code so SELECT/UPDATE/DELETE role cells have a
    // target row without depending on any role's INSERT succeeding first.
    const { data: seed, error: seedErr } = await ctx.service
      .from("discount_codes")
      .insert({
        tenant_id: tenantId,
        code: `MATRIX-${randomUUID().slice(0, 8).toUpperCase()}`,
        discount_type: "percent",
        discount_value: 10,
        is_active: true,
      })
      .select("id")
      .single();
    if (seedErr || !seed) throw seedErr ?? new Error("discount seed failed");
    ctx.seededDiscountId = seed.id as string;
    ctx.cleanupDiscounts.push(seed.id as string);
  }, 90_000);

  afterAll(async () => {
    if (!ctx.service) return;
    const swallow = async (p: PromiseLike<unknown>) => {
      try { await p; } catch { /* best-effort */ }
    };
    for (const id of ctx.cleanupDiscounts) {
      await swallow(ctx.service.from("discount_codes").delete().eq("id", id));
    }
    for (const t of ctx.cleanupTenants) {
      await swallow(ctx.service.from("discount_codes").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenants").delete().eq("id", t));
    }
    for (const u of ctx.cleanupUsers) {
      await swallow(ctx.service.auth.admin.deleteUser(u));
    }
  }, 60_000);

  // ─── Billing columns on public.tenants ──────────────────────────────
  describe("public.tenants billing column mutations", () => {
    const denyRoles: Role[] = ["anon", "outsider", "staff", "admin", "owner"];

    it.each(denyRoles)("role=%s cannot update ANY billing column", async (role) => {
      const client = await clientFor(role);
      try {
        for (const patch of BILLING_PATCHES) {
          const { error, data } = await client
            .from("tenants")
            .update(patch)
            .eq("id", ctx.tenantId)
            .select("id");
          expect(
            mutationBlocked(error, data),
            `[${role}] patch ${JSON.stringify(patch)} must NOT apply`,
          ).toBe(true);
        }
      } finally {
        if (role !== "anon") await client.auth.signOut();
      }
    });

    it("owner CAN still update non-billing columns (positive control)", async () => {
      const client = await signedInClient(ctx.owner);
      try {
        const newName = `TEST CI matrix renamed ${randomUUID().slice(0, 6)}`;
        const { error, data } = await client
          .from("tenants")
          .update({ name: newName })
          .eq("id", ctx.tenantId)
          .select("id, name")
          .single();
        expect(error, "owner rename must succeed").toBeNull();
        expect(data?.name).toBe(newName);
      } finally {
        await client.auth.signOut();
      }
    });

    it("admin CAN update non-billing columns (positive control)", async () => {
      const client = await signedInClient(ctx.admin);
      try {
        const newName = `TEST CI matrix admin-renamed ${randomUUID().slice(0, 6)}`;
        const { error, data } = await client
          .from("tenants")
          .update({ name: newName })
          .eq("id", ctx.tenantId)
          .select("id, name")
          .single();
        expect(error, "admin rename must succeed").toBeNull();
        expect(data?.name).toBe(newName);
      } finally {
        await client.auth.signOut();
      }
    });

    it("post-condition: billing columns are still their seeded values", async () => {
      const { data } = await ctx.service
        .from("tenants")
        .select(
          "tier, subscription_status, stripe_customer_id, stripe_subscription_id, discount_percentage",
        )
        .eq("id", ctx.tenantId)
        .single();
      expect(data?.tier).toBe("basic");
      expect(data?.subscription_status).toBe("trialing");
      expect(data?.stripe_customer_id).toBeNull();
      expect(data?.stripe_subscription_id).toBeNull();
      expect(data?.discount_percentage ?? 0).not.toBe(42);
    });

    it("service_role CAN update billing columns (positive control, then reverted)", async () => {
      const { error: upErr } = await ctx.service
        .from("tenants")
        .update({ stripe_customer_id: "cus_service_role_ok" })
        .eq("id", ctx.tenantId);
      expect(upErr, "service_role write must succeed").toBeNull();

      const { data: after } = await ctx.service
        .from("tenants")
        .select("stripe_customer_id")
        .eq("id", ctx.tenantId)
        .single();
      expect(after?.stripe_customer_id).toBe("cus_service_role_ok");

      // Revert so the earlier post-condition invariant continues to hold
      // if the suite is re-ordered by anyone in the future.
      await ctx.service
        .from("tenants")
        .update({ stripe_customer_id: null })
        .eq("id", ctx.tenantId);
    });
  });

  // ─── public.discount_codes CRUD role matrix ─────────────────────────
  describe("public.discount_codes CRUD", () => {
    const buildCodePayload = (label: string) => ({
      tenant_id: ctx.tenantId,
      code: `MATRIX-${label}-${randomUUID().slice(0, 6).toUpperCase()}`,
      discount_type: "percent",
      discount_value: 5,
      is_active: true,
    });

    // INSERT
    it.each(["anon", "outsider", "staff"] as Role[])(
      "role=%s cannot INSERT discount codes",
      async (role) => {
        const client = await clientFor(role);
        try {
          const { data, error } = await client
            .from("discount_codes")
            .insert(buildCodePayload(role))
            .select("id");
          expect(mutationBlocked(error, data), `[${role}] INSERT must fail`).toBe(true);
        } finally {
          if (role !== "anon") await client.auth.signOut();
        }
      },
    );

    it.each(["owner", "admin"] as Role[])(
      "role=%s CAN INSERT discount codes",
      async (role) => {
        const client = await clientFor(role);
        try {
          const { data, error } = await client
            .from("discount_codes")
            .insert(buildCodePayload(role))
            .select("id")
            .single();
          expect(error, `[${role}] INSERT should succeed`).toBeNull();
          expect(data?.id).toBeTruthy();
          if (data?.id) ctx.cleanupDiscounts.push(data.id as string);
        } finally {
          await client.auth.signOut();
        }
      },
    );

    // UPDATE
    it.each(["anon", "outsider", "staff"] as Role[])(
      "role=%s cannot UPDATE discount codes",
      async (role) => {
        const client = await clientFor(role);
        try {
          const { data, error } = await client
            .from("discount_codes")
            .update({ discount_value: 99, is_active: false })
            .eq("id", ctx.seededDiscountId)
            .select("id");
          expect(mutationBlocked(error, data), `[${role}] UPDATE must not apply`).toBe(true);
        } finally {
          if (role !== "anon") await client.auth.signOut();
        }

        // Confirm the seeded row was not mutated.
        const { data: after } = await ctx.service
          .from("discount_codes")
          .select("discount_value, is_active")
          .eq("id", ctx.seededDiscountId)
          .single();
        expect(after?.discount_value).toBe(10);
        expect(after?.is_active).toBe(true);
      },
    );

    it.each(["owner", "admin"] as Role[])(
      "role=%s CAN UPDATE their tenant's discount codes",
      async (role) => {
        const client = await clientFor(role);
        try {
          const marker = Math.floor(Math.random() * 1000) + 20; // avoid clashing with seed=10
          const { data, error } = await client
            .from("discount_codes")
            .update({ discount_value: marker })
            .eq("id", ctx.seededDiscountId)
            .select("id, discount_value")
            .single();
          expect(error, `[${role}] UPDATE should succeed`).toBeNull();
          expect(data?.discount_value).toBe(marker);
        } finally {
          await client.auth.signOut();
        }
      },
    );

    // SELECT
    it.each(["anon", "outsider"] as Role[])(
      "role=%s cannot SELECT discount codes",
      async (role) => {
        const client = await clientFor(role);
        try {
          const { data, error } = await client
            .from("discount_codes")
            .select("id")
            .eq("id", ctx.seededDiscountId);
          // Either an explicit RLS error OR an empty result set (row filtered out).
          const blocked = Boolean(error) || !data || data.length === 0;
          expect(blocked, `[${role}] SELECT must not return the row`).toBe(true);
        } finally {
          if (role !== "anon") await client.auth.signOut();
        }
      },
    );

    it.each(["staff", "admin", "owner"] as Role[])(
      "role=%s CAN SELECT their tenant's discount codes",
      async (role) => {
        const client = await clientFor(role);
        try {
          const { data, error } = await client
            .from("discount_codes")
            .select("id")
            .eq("id", ctx.seededDiscountId)
            .maybeSingle();
          expect(error, `[${role}] SELECT should succeed`).toBeNull();
          expect(data?.id).toBe(ctx.seededDiscountId);
        } finally {
          await client.auth.signOut();
        }
      },
    );

    // DELETE
    it.each(["anon", "outsider", "staff"] as Role[])(
      "role=%s cannot DELETE discount codes",
      async (role) => {
        // Provision a fresh, deletable row via service role for each attempt.
        const { data: target, error: seedErr } = await ctx.service
          .from("discount_codes")
          .insert(buildCodePayload(`del-${role}`))
          .select("id")
          .single();
        if (seedErr || !target) throw seedErr ?? new Error("target seed failed");
        ctx.cleanupDiscounts.push(target.id as string);

        const client = await clientFor(role);
        try {
          const { data, error } = await client
            .from("discount_codes")
            .delete()
            .eq("id", target.id as string)
            .select("id");
          expect(mutationBlocked(error, data), `[${role}] DELETE must not apply`).toBe(true);
        } finally {
          if (role !== "anon") await client.auth.signOut();
        }

        // Row must still exist.
        const { data: still } = await ctx.service
          .from("discount_codes")
          .select("id")
          .eq("id", target.id as string)
          .maybeSingle();
        expect(still?.id).toBe(target.id);
      },
    );

    it.each(["owner", "admin"] as Role[])(
      "role=%s CAN DELETE their tenant's discount codes",
      async (role) => {
        const { data: target, error: seedErr } = await ctx.service
          .from("discount_codes")
          .insert(buildCodePayload(`del-ok-${role}`))
          .select("id")
          .single();
        if (seedErr || !target) throw seedErr ?? new Error("target seed failed");

        const client = await clientFor(role);
        try {
          const { data, error } = await client
            .from("discount_codes")
            .delete()
            .eq("id", target.id as string)
            .select("id")
            .single();
          expect(error, `[${role}] DELETE should succeed`).toBeNull();
          expect(data?.id).toBe(target.id);
        } finally {
          await client.auth.signOut();
        }

        // Confirm it's really gone.
        const { data: gone } = await ctx.service
          .from("discount_codes")
          .select("id")
          .eq("id", target.id as string)
          .maybeSingle();
        expect(gone).toBeNull();
      },
    );
  });
});
