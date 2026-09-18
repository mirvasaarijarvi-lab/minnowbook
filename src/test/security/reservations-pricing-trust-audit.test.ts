/**
 * `validate_public_reservation_insert()` writes an audit_log entry
 * (`action = 'pricing_trust_decision'`) describing which pricing/discount
 * fields it kept for a trusted service_role insert and which it scrubbed for
 * anonymous public-booking traffic.
 *
 * Live spec: needs SUPABASE_URL + anon key + service role key; skips otherwise.
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

const ctx = {
  service: null as unknown as SupabaseClient,
  anon: null as unknown as SupabaseClient,
  ownerId: "",
  tenantId: "",
};

const futureDate = () =>
  new Date(Date.now() + 12 * 86_400_000).toISOString().slice(0, 10);

const baseRow = (name: string) => ({
  tenant_id: ctx.tenantId,
  reservation_type: "restaurant",
  date: futureDate(),
  guest_name: name,
  guest_email: "ci-trust-audit@mimmobook.test",
  status: "pending",
});

type AuditEntry = {
  id: string;
  record_id: string | null;
  action: string;
  summary: string | null;
  new_data: {
    trusted?: boolean;
    jwt_role?: string | null;
    db_user?: string | null;
    kept_fields?: string[];
    scrubbed_fields?: string[];
    submitted_values?: Record<string, unknown>;
  } | null;
};

async function auditFor(reservationId: string): Promise<AuditEntry[]> {
  const { data, error } = await ctx.service
    .from("audit_log")
    .select("id, record_id, action, summary, new_data")
    .eq("tenant_id", ctx.tenantId)
    .eq("table_name", "reservations")
    .eq("action", "pricing_trust_decision")
    .eq("record_id", reservationId);
  if (error) throw error;
  return (data ?? []) as unknown as AuditEntry[];
}

async function idOf(guestName: string): Promise<string> {
  const { data, error } = await ctx.service
    .from("reservations")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("guest_name", guestName)
    .single();
  if (error) throw error;
  return data!.id as string;
}

describe.runIf(canRun)(
  "reservations — pricing trust decisions are audited (live)",
  () => {
    beforeAll(async () => {
      ctx.service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      ctx.anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const email = `ci+trustaudit-${randomUUID().slice(0, 8)}@mimmobook.test`;
      const { data: userRes, error: userErr } =
        await ctx.service.auth.admin.createUser({
          email,
          password: `Ci-TrustAudit-${randomUUID()}-Z9!`,
          email_confirm: true,
        });
      if (userErr || !userRes.user)
        throw userErr ?? new Error("createUser failed");
      ctx.ownerId = userRes.user.id;

      const id = randomUUID();
      const short = id.slice(0, 8);
      const { error: tErr } = await ctx.service.from("tenants").insert({
        id,
        name: `TEST CI trustaudit ${short}`,
        slug: `ci-trustaudit-${short}`,
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
      await swallow(
        ctx.service.from("reservations").delete().eq("tenant_id", ctx.tenantId),
      );
      await swallow(
        ctx.service.from("audit_log").delete().eq("tenant_id", ctx.tenantId),
      );
      await swallow(
        ctx.service.from("tenant_users").delete().eq("tenant_id", ctx.tenantId),
      );
      await swallow(
        ctx.service.from("tenants").delete().eq("id", ctx.tenantId),
      );
      if (ctx.ownerId)
        await swallow(ctx.service.auth.admin.deleteUser(ctx.ownerId));
    }, 90_000);

    it("records the kept pricing fields for a trusted service_role insert", async () => {
      const name = `TEST CI trustaudit kept ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.service.from("reservations").insert({
        ...baseRow(name),
        original_price_eur: 120,
        price_eur: 90,
        discount_type: "percentage",
        discount_value: 25,
        discount_reason: "Promo code: AUDIT25",
        pricing_details: "2 nights",
      });
      expect(error, error?.message).toBeNull();

      const entries = await auditFor(await idOf(name));
      expect(entries).toHaveLength(1);
      const entry = entries[0];
      expect(entry.new_data?.trusted).toBe(true);
      expect(entry.summary).toContain("Trusted insert");
      expect(entry.new_data?.scrubbed_fields).toEqual([]);
      const kept = entry.new_data?.kept_fields ?? [];
      for (const field of [
        "price_eur",
        "original_price_eur",
        "pricing_details",
        "discount_type",
        "discount_value",
        "discount_reason",
      ]) {
        expect(kept, `kept should list ${field}`).toContain(field);
      }
      expect(Number(entry.new_data?.submitted_values?.price_eur)).toBe(90);
      expect(Number(entry.new_data?.submitted_values?.original_price_eur)).toBe(
        120,
      );
    });

    it("records the scrubbed pricing fields when anonymous traffic submits them", async () => {
      const name = `TEST CI trustaudit scrubbed ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.anon.from("reservations").insert({
        ...baseRow(name),
        price_eur: 1,
        original_price_eur: 999,
        discount_type: "percentage",
        discount_value: 90,
      });
      expect(error, error?.message).toBeNull();

      const reservationId = await idOf(name);
      const entries = await auditFor(reservationId);
      expect(entries).toHaveLength(1);
      const entry = entries[0];
      expect(entry.new_data?.trusted).toBe(false);
      expect(entry.summary).toContain("Untrusted insert");
      expect(entry.new_data?.kept_fields).toEqual([]);
      const scrubbed = entry.new_data?.scrubbed_fields ?? [];
      for (const field of [
        "price_eur",
        "original_price_eur",
        "discount_type",
        "discount_value",
      ]) {
        expect(scrubbed, `scrubbed should list ${field}`).toContain(field);
      }
      // The attempted values are recorded for forensics, but nothing was stored.
      expect(Number(entry.new_data?.submitted_values?.price_eur)).toBe(1);

      const { data: stored } = await ctx.service
        .from("reservations")
        .select("price_eur, original_price_eur, discount_type, discount_value")
        .eq("id", reservationId)
        .single();
      expect(stored!.price_eur).toBeNull();
      expect(stored!.original_price_eur).toBeNull();
      expect(stored!.discount_type).toBeNull();
      expect(stored!.discount_value).toBeNull();
    });

    it("does not log an entry for an ordinary anonymous booking with no pricing fields", async () => {
      const name = `TEST CI trustaudit clean ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.anon
        .from("reservations")
        .insert(baseRow(name));
      expect(error, error?.message).toBeNull();

      expect(await auditFor(await idOf(name))).toHaveLength(0);
    });

    it("logs a trusted insert even when no pricing fields were supplied", async () => {
      const name = `TEST CI trustaudit bare ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.service
        .from("reservations")
        .insert(baseRow(name));
      expect(error, error?.message).toBeNull();

      const entries = await auditFor(await idOf(name));
      expect(entries).toHaveLength(1);
      expect(entries[0].new_data?.trusted).toBe(true);
      expect(entries[0].new_data?.kept_fields).toEqual([]);
      expect(entries[0].summary).toContain("(none)");
    });

    it("leaves no audit entry when the insert is rejected", async () => {
      const name = `TEST CI trustaudit rejected ${randomUUID().slice(0, 8)}`;
      const { error } = await ctx.service
        .from("reservations")
        .insert({ ...baseRow(name), price_eur: -5 });
      expect(error, "negative price must be rejected").toBeTruthy();

      const { data, error: readErr } = await ctx.service
        .from("audit_log")
        .select("id, new_data")
        .eq("tenant_id", ctx.tenantId)
        .eq("action", "pricing_trust_decision");
      if (readErr) throw readErr;
      const leaked = (data ?? []).filter(
        (r) =>
          Number(
            (
              (r.new_data as Record<string, unknown> | null)
                ?.submitted_values as Record<string, unknown> | undefined
            )?.price_eur,
          ) === -5,
      );
      expect(leaked).toHaveLength(0);
    });

    it("anon cannot read the pricing decision entries", async () => {
      const { data, error } = await ctx.anon
        .from("audit_log")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("action", "pricing_trust_decision");
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    });
  },
);
