/**
 * Integration: when a BEFORE INSERT trigger on `public.reservations` fails
 * (raised exception) or a CHECK constraint rejects the row, nothing may be
 * persisted — no reservation row, no half-written pricing, no audit trail
 * entry.
 *
 * Failure is provoked through the real code paths rather than a test-only
 * hook:
 *   - `validate_public_reservation_insert()` raises `22023` for anonymous
 *     inserts with control characters in `guest_name`, a bad e-mail shape or
 *     a past date.
 *   - CHECK constraints reject negative money after the triggers have already
 *     rewritten the row, which is the interesting case: the trigger's work
 *     must roll back with the statement.
 * Multi-row inserts assert statement atomicity: one bad row poisons the whole
 * batch, so a valid priced row in the same statement must not survive.
 *
 * Live spec: needs SUPABASE_URL + anon key + service role key; skips otherwise.
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

const ctx = {
  service: null as unknown as SupabaseClient,
  anon: null as unknown as SupabaseClient,
  ownerId: "",
  tenantId: "",
};

const futureDate = () => new Date(Date.now() + 11 * 86_400_000).toISOString().slice(0, 10);
const pastDate = () => new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);

const baseRow = (name: string) => ({
  tenant_id: ctx.tenantId,
  reservation_type: "restaurant",
  date: futureDate(),
  guest_name: name,
  guest_email: "ci-trigger-failure@mimmobook.test",
  status: "pending",
});

/** Rows visible to the service role for a given guest name. */
async function rowsFor(name: string) {
  const { data, error } = await ctx.service
    .from("reservations")
    .select("id, price_eur, original_price_eur, discount_type, discount_value, status")
    .eq("tenant_id", ctx.tenantId)
    .eq("guest_name", name);
  if (error) throw error;
  return data ?? [];
}

/** Audit rows the failed statement must not have left behind. */
async function auditCountFor(name: string) {
  const { data, error } = await ctx.service
    .from("audit_log")
    .select("id, new_data")
    .eq("tenant_id", ctx.tenantId)
    .eq("table_name", "reservations");
  if (error) throw error;
  return (data ?? []).filter(
    (r) => (r.new_data as Record<string, unknown> | null)?.guest_name === name,
  ).length;
}

describe.runIf(canRun)(
  "reservations — trigger failure rolls back without partial pricing (live)",
  () => {
    beforeAll(async () => {
      ctx.service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      ctx.anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const email = `ci+trigfail-${randomUUID().slice(0, 8)}@mimmobook.test`;
      const { data: userRes, error: userErr } = await ctx.service.auth.admin.createUser({
        email,
        password: `Ci-TrigFail-${randomUUID()}-Z9!`,
        email_confirm: true,
      });
      if (userErr || !userRes.user) throw userErr ?? new Error("createUser failed");
      ctx.ownerId = userRes.user.id;

      const id = randomUUID();
      const short = id.slice(0, 8);
      const { error: tErr } = await ctx.service.from("tenants").insert({
        id,
        name: `TEST CI trigfail ${short}`,
        slug: `ci-trigfail-${short}`,
        tier: "basic",
        allowed_reservation_types: ["restaurant"],
        owner_user_id: ctx.ownerId,
        subscription_status: "trialing",
        is_active: true,
      });
      if (tErr) throw tErr;
      ctx.tenantId = id;
    }, 90_000);

    afterAll(async () => {
      if (!ctx.service || !ctx.tenantId) return;
      const swallow = async (p: PromiseLike<unknown>) => {
        try {
          await p;
        } catch {
          /* best-effort cleanup */
        }
      };
      await swallow(ctx.service.from("reservations").delete().eq("tenant_id", ctx.tenantId));
      await swallow(ctx.service.from("audit_log").delete().eq("tenant_id", ctx.tenantId));
      await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", ctx.tenantId));
      await swallow(ctx.service.from("tenants").delete().eq("id", ctx.tenantId));
      if (ctx.ownerId) await swallow(ctx.service.auth.admin.deleteUser(ctx.ownerId));
    }, 90_000);

    it("anon insert raising inside the trigger stores nothing at all", async () => {
      const name = `TEST CI trigfail ctrl ${randomUUID().slice(0, 8)}\u0007`;
      const { error } = await ctx.anon
        .from("reservations")
        .insert({ ...baseRow(name), price_eur: 999, discount_type: "percentage", discount_value: 50 });

      expect(error, "trigger must reject control characters").toBeTruthy();
      expect(await rowsFor(name)).toHaveLength(0);
      expect(await auditCountFor(name)).toBe(0);
    });

    it("anon insert with a past date is rejected with no row written", async () => {
      const name = `TEST CI trigfail past ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.anon
        .from("reservations")
        .insert({ ...baseRow(name), date: pastDate(), price_eur: 500 });

      expect(error).toBeTruthy();
      expect(await rowsFor(name)).toHaveLength(0);
    });

    it("anon insert with a malformed e-mail is rejected with no row written", async () => {
      const name = `TEST CI trigfail mail ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.anon
        .from("reservations")
        .insert({ ...baseRow(name), guest_email: "not-an-email", price_eur: 250 });

      expect(error).toBeTruthy();
      expect(await rowsFor(name)).toHaveLength(0);
    });

    it("a failing row aborts the whole anon batch, including the valid priced row", async () => {
      const good = `TEST CI trigfail batch-ok ${randomUUID().slice(0, 8)}`;
      const bad = `TEST CI trigfail batch-bad ${randomUUID().slice(0, 8)}\u0000`;
      const { error } = await ctx.anon.from("reservations").insert([
        { ...baseRow(good), price_eur: 75 },
        { ...baseRow(bad) },
      ]);

      expect(error, "batch must fail").toBeTruthy();
      expect(await rowsFor(good), "valid sibling row must roll back").toHaveLength(0);
      expect(await rowsFor(bad)).toHaveLength(0);
    });

    it("service_role batch aborts when a constraint fires after the trigger rewrote pricing", async () => {
      const good = `TEST CI trigfail svc-ok ${randomUUID().slice(0, 8)}`;
      const bad = `TEST CI trigfail svc-bad ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.service.from("reservations").insert([
        {
          ...baseRow(good),
          original_price_eur: 120,
          price_eur: 90,
          discount_type: "percentage",
          discount_value: 25,
        },
        // Negative money survives the triggers and dies on chk_reservations_price_eur_nonneg.
        { ...baseRow(bad), price_eur: -10 },
      ]);

      expect(error, "batch must fail on the negative price").toBeTruthy();
      expect(await rowsFor(good), "no partial pricing may persist").toHaveLength(0);
      expect(await rowsFor(bad)).toHaveLength(0);
      expect(await auditCountFor(good)).toBe(0);
    });

    it("a failed update leaves the previously stored pricing untouched", async () => {
      const name = `TEST CI trigfail upd ${randomUUID().slice(0, 8)}`;
      const { data: created, error: createErr } = await ctx.service
        .from("reservations")
        .insert({
          ...baseRow(name),
          original_price_eur: 200,
          price_eur: 150,
          discount_type: "percentage",
          discount_value: 25,
          discount_reason: "Promo code: CITRIG",
        })
        .select("id")
        .single();
      expect(createErr, createErr?.message).toBeNull();
      const id = created!.id as string;

      const { error: updErr } = await ctx.service
        .from("reservations")
        .update({ price_eur: -1, original_price_eur: 500, discount_value: 40 })
        .eq("id", id);
      expect(updErr, "negative price update must fail").toBeTruthy();

      const { data: after, error: readErr } = await ctx.service
        .from("reservations")
        .select("price_eur, original_price_eur, discount_type, discount_value, discount_reason")
        .eq("id", id)
        .single();
      expect(readErr, readErr?.message).toBeNull();
      expect(Number(after!.price_eur)).toBe(150);
      expect(Number(after!.original_price_eur)).toBe(200);
      expect(after!.discount_type).toBe("percentage");
      expect(Number(after!.discount_value)).toBe(25);
      expect(after!.discount_reason).toBe("Promo code: CITRIG");
    });

    it("a valid insert still succeeds after the failures (triggers not left broken)", async () => {
      const name = `TEST CI trigfail sanity ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.service.from("reservations").insert({
        ...baseRow(name),
        original_price_eur: 60,
        price_eur: 60,
      });
      expect(error, error?.message).toBeNull();
      const rows = await rowsFor(name);
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].price_eur)).toBe(60);
    });
  },
);
