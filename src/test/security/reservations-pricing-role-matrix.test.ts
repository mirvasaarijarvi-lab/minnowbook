/**
 * End-to-end role matrix: who may create or edit PRICING-relevant fields on a
 * booking.
 *
 * "Pricing-relevant" == every column that decides what a guest owes or whether
 * the stay is billable: price_eur, original_price_eur, pricing_type,
 * pricing_details, stall_fee, breakfast_price_per_person, the four discount
 * columns and is_invoiced.
 *
 *   ┌────────────────────┬──────────────────────┬──────────────────────────┐
 *   │ actor              │ INSERT with pricing  │ UPDATE pricing on a row  │
 *   ├────────────────────┼──────────────────────┼──────────────────────────┤
 *   │ anon (guest)       │ DENY (RLS with_check)│ DENY                     │
 *   │ authenticated      │ DENY (not a member)  │ DENY                     │
 *   │ non-member         │                      │                          │
 *   │ unapproved member  │ DENY (is_approved)   │ DENY                     │
 *   │ other tenant's     │ DENY (tenant scope)  │ DENY                     │
 *   │ owner              │                      │                          │
 *   │ staff              │ ALLOW                │ ALLOW                    │
 *   │ admin              │ ALLOW                │ ALLOW                    │
 *   │ owner              │ ALLOW                │ ALLOW                    │
 *   └────────────────────┴──────────────────────┴──────────────────────────┘
 *
 * Denials are asserted against the stored row, not just the API response: a
 * blocked write must leave no row behind and must not change a single cent of
 * an existing booking.
 *
 * Skips cleanly when live Supabase credentials are unavailable (fork PRs).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY);

/** Pricing-relevant payload used for both INSERT and UPDATE attempts. */
const PRICING_FIELDS = {
  price_eur: 222.75,
  original_price_eur: 297,
  discount_type: "percentage",
  discount_value: 25,
  discount_reason: "Promo code: ROLEMATRIX25",
  pricing_type: "fixed_price",
  pricing_details: "3 nights x 75 + breakfast",
  breakfast_price_per_person: 12,
  is_invoiced: true,
} as const;

type Actor = { userId: string; email: string; password: string };

interface Ctx {
  service: SupabaseClient;
  tenantId: string;
  otherTenantId: string;
  owner: Actor;
  admin: Actor;
  staff: Actor;
  unapproved: Actor;
  outsider: Actor;
  otherOwner: Actor;
  targetReservationId: string;
  cleanupUsers: string[];
  cleanupTenants: string[];
}

const ctx = {
  cleanupUsers: [],
  cleanupTenants: [],
} as unknown as Ctx;

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function createUser(label: string): Promise<Actor> {
  const email = `ci+pricingrole-${label}-${randomUUID().slice(0, 8)}@mimmobook.test`;
  const password = `Ci-Pricing-${randomUUID()}-Z9!`;
  const { data, error } = await ctx.service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  ctx.cleanupUsers.push(data.user.id);
  return { userId: data.user.id, email, password };
}

async function createTenant(ownerUserId: string): Promise<string> {
  const id = randomUUID();
  const short = id.slice(0, 8);
  const { error } = await ctx.service.from("tenants").insert({
    id,
    name: `TEST CI pricing-role ${short}`,
    slug: `ci-pricing-role-${short}`,
    tier: "professional",
    allowed_reservation_types: ["guesthouse", "restaurant"],
    owner_user_id: ownerUserId,
    subscription_status: "trialing",
    is_active: true,
  });
  if (error) throw error;
  ctx.cleanupTenants.push(id);
  return id;
}

async function addMember(
  tenantId: string,
  actor: Actor,
  role: "owner" | "admin" | "staff",
  approved = true,
) {
  const { error } = await ctx.service.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: actor.userId,
    role,
    is_approved: approved,
  });
  if (error) throw error;
}

async function signedIn(actor: Actor): Promise<SupabaseClient> {
  const client = newAnon();
  const { error } = await client.auth.signInWithPassword({
    email: actor.email,
    password: actor.password,
  });
  if (error) throw error;
  return client;
}

const futureDate = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
};

const baseBooking = (tenantId: string, label: string) => ({
  tenant_id: tenantId,
  reservation_type: "guesthouse",
  status: "pending",
  date: futureDate(30),
  check_out_date: futureDate(33),
  guest_name: `TEST CI pricing ${label}`,
  guest_email: `ci+pricing-${label}@mimmobook.test`,
  guests_count: 2,
  breakfast_included: true,
  language: "en",
});

/** Blocked == explicit error, or nothing came back / was written. */
const blocked = (error: unknown, data: unknown[] | null | undefined) =>
  Boolean(error) || !data || data.length === 0;

const PRICING_COLUMNS =
  "id, price_eur, original_price_eur, discount_type, discount_value, discount_reason, pricing_type, pricing_details, breakfast_price_per_person, is_invoiced";

describe.runIf(canRun)(
  "reservation pricing fields — staff role matrix (live)",
  () => {
    beforeAll(async () => {
      ctx.service = newService();

      ctx.owner = await createUser("owner");
      ctx.admin = await createUser("admin");
      ctx.staff = await createUser("staff");
      ctx.unapproved = await createUser("unapproved");
      ctx.outsider = await createUser("outsider");
      ctx.otherOwner = await createUser("otherowner");

      ctx.tenantId = await createTenant(ctx.owner.userId);
      ctx.otherTenantId = await createTenant(ctx.otherOwner.userId);

      await addMember(ctx.tenantId, ctx.owner, "owner");
      await addMember(ctx.tenantId, ctx.admin, "admin");
      await addMember(ctx.tenantId, ctx.staff, "staff");
      await addMember(ctx.tenantId, ctx.unapproved, "staff", false);
      await addMember(ctx.otherTenantId, ctx.otherOwner, "owner");

      // The booking every UPDATE attempt targets, priced by the server.
      const { data, error } = await ctx.service
        .from("reservations")
        .insert({ ...baseBooking(ctx.tenantId, "target"), ...PRICING_FIELDS })
        .select("id")
        .single();
      if (error || !data)
        throw error ?? new Error("target reservation insert failed");
      ctx.targetReservationId = data.id as string;
    }, 120_000);

    afterAll(async () => {
      if (!ctx.service) return;
      const swallow = async (p: PromiseLike<unknown>) => {
        try {
          await p;
        } catch {
          /* best-effort */
        }
      };
      for (const t of ctx.cleanupTenants) {
        await swallow(
          ctx.service.from("reservations").delete().eq("tenant_id", t),
        );
        await swallow(
          ctx.service.from("tenant_users").delete().eq("tenant_id", t),
        );
        await swallow(ctx.service.from("tenants").delete().eq("id", t));
      }
      for (const u of ctx.cleanupUsers) {
        await swallow(ctx.service.auth.admin.deleteUser(u));
      }
    }, 90_000);

    /** Reads the target booking with the service key, bypassing RLS. */
    async function readTarget() {
      const { data, error } = await ctx.service
        .from("reservations")
        .select(PRICING_COLUMNS)
        .eq("id", ctx.targetReservationId)
        .single();
      if (error || !data) throw error ?? new Error("target read failed");
      return data as Record<string, unknown>;
    }

    // ─── Unauthorized actors ────────────────────────────────────────────
    it("anon guests cannot create a booking carrying any pricing field", async () => {
      const anon = newAnon();
      for (const [field, value] of Object.entries(PRICING_FIELDS)) {
        const label = `anon-${field}`;
        const { error, data } = await anon
          .from("reservations")
          .insert({ ...baseBooking(ctx.tenantId, label), [field]: value })
          .select("id");
        expect(blocked(error, data), `anon must not set ${field}`).toBe(true);

        const { data: rows } = await ctx.service
          .from("reservations")
          .select("id")
          .eq("guest_email", `ci+pricing-${label}@mimmobook.test`);
        expect(
          rows ?? [],
          `no row may exist after anon set ${field}`,
        ).toHaveLength(0);
      }
    }, 120_000);

    it("anon guests cannot edit pricing on an existing booking", async () => {
      const before = await readTarget();
      const anon = newAnon();
      const { error, data } = await anon
        .from("reservations")
        .update({ price_eur: 1, is_invoiced: false, discount_value: 95 })
        .eq("id", ctx.targetReservationId)
        .select("id");
      expect(blocked(error, data)).toBe(true);
      expect(await readTarget()).toEqual(before);
    }, 60_000);

    it.each([
      ["authenticated non-member", "outsider"],
      ["unapproved tenant member", "unapproved"],
      ["another tenant's owner", "otherOwner"],
    ] as const)(
      "%s can neither create nor edit priced bookings",
      async (_label, key) => {
        const actor = ctx[key as "outsider" | "unapproved" | "otherOwner"];
        const client = await signedIn(actor);
        try {
          const label = `deny-${key}-${randomUUID().slice(0, 6)}`;
          const ins = await client
            .from("reservations")
            .insert({ ...baseBooking(ctx.tenantId, label), ...PRICING_FIELDS })
            .select("id");
          expect(blocked(ins.error, ins.data), "insert must be blocked").toBe(
            true,
          );
          const { data: rows } = await ctx.service
            .from("reservations")
            .select("id")
            .eq("guest_email", `ci+pricing-${label}@mimmobook.test`);
          expect(rows ?? [], "no booking may be created").toHaveLength(0);

          const before = await readTarget();
          const upd = await client
            .from("reservations")
            .update({ price_eur: 1, original_price_eur: 1, is_invoiced: false })
            .eq("id", ctx.targetReservationId)
            .select("id");
          expect(blocked(upd.error, upd.data), "update must be blocked").toBe(
            true,
          );
          expect(await readTarget(), "not a cent may change").toEqual(before);
        } finally {
          await client.auth.signOut();
        }
      },
      120_000,
    );

    // ─── Authorized staff roles ─────────────────────────────────────────
    it.each(["owner", "admin", "staff"] as const)(
      "%s can create a booking with pricing fields and they persist unchanged",
      async (key) => {
        const client = await signedIn(ctx[key]);
        try {
          const label = `allow-${key}-${randomUUID().slice(0, 6)}`;
          const { data, error } = await client
            .from("reservations")
            .insert({ ...baseBooking(ctx.tenantId, label), ...PRICING_FIELDS })
            .select(PRICING_COLUMNS)
            .single();
          expect(error, `${key} insert must succeed`).toBeNull();
          expect(Number(data?.price_eur)).toBe(222.75);
          expect(Number(data?.original_price_eur)).toBe(297);
          expect(data?.discount_type).toBe("percentage");
          expect(Number(data?.discount_value)).toBe(25);
          expect(data?.discount_reason).toBe(PRICING_FIELDS.discount_reason);
          expect(data?.pricing_type).toBe("fixed_price");
          expect(data?.pricing_details).toBe(PRICING_FIELDS.pricing_details);
          expect(Number(data?.breakfast_price_per_person)).toBe(12);
          expect(data?.is_invoiced).toBe(true);
        } finally {
          await client.auth.signOut();
        }
      },
      120_000,
    );

    it.each(["owner", "admin", "staff"] as const)(
      "%s can edit pricing fields on an existing booking",
      async (key) => {
        const client = await signedIn(ctx[key]);
        try {
          const newPrice = 250 + Math.round(Math.random() * 5000) / 100;
          const { data, error } = await client
            .from("reservations")
            .update({
              price_eur: newPrice,
              original_price_eur: 400,
              pricing_details: `edited by ${key}`,
            })
            .eq("id", ctx.targetReservationId)
            .select(PRICING_COLUMNS)
            .single();
          expect(error, `${key} update must succeed`).toBeNull();
          expect(Number(data?.price_eur)).toBe(newPrice);
          expect(Number(data?.original_price_eur)).toBe(400);
          expect(data?.pricing_details).toBe(`edited by ${key}`);
        } finally {
          await client.auth.signOut();
          // Restore the canonical target row for the remaining denial assertions.
          await ctx.service
            .from("reservations")
            .update(PRICING_FIELDS)
            .eq("id", ctx.targetReservationId);
        }
      },
      120_000,
    );

    it("staff cannot reach another tenant's booking pricing", async () => {
      const { data: other, error: insErr } = await ctx.service
        .from("reservations")
        .insert({
          ...baseBooking(
            ctx.otherTenantId,
            `other-${randomUUID().slice(0, 6)}`,
          ),
          price_eur: 500,
        })
        .select("id")
        .single();
      if (insErr || !other)
        throw insErr ?? new Error("other-tenant insert failed");

      const client = await signedIn(ctx.staff);
      try {
        const upd = await client
          .from("reservations")
          .update({ price_eur: 1, is_invoiced: true })
          .eq("id", other.id)
          .select("id");
        expect(blocked(upd.error, upd.data)).toBe(true);
        const { data: after } = await ctx.service
          .from("reservations")
          .select("price_eur, is_invoiced")
          .eq("id", other.id)
          .single();
        expect(Number(after?.price_eur)).toBe(500);
        expect(after?.is_invoiced).not.toBe(true);
      } finally {
        await client.auth.signOut();
        await ctx.service.from("reservations").delete().eq("id", other.id);
      }
    }, 120_000);
  },
);
