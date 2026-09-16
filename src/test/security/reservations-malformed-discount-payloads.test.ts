/**
 * Regression: malformed pricing/discount payloads inserted with the service
 * role must be scrubbed or rejected, never stored as-is.
 *
 * The service role is a trusted context (the `public-booking` edge function
 * computes canonical pricing server-side), so the insert trigger deliberately
 * keeps its pricing fields. That trust must not extend to payloads that are
 * internally inconsistent: a bug or a compromised server-side caller could
 * otherwise persist a 500% discount, a NaN price, a promo code owned by
 * another tenant, or a gross total below the amount actually charged.
 *
 * Covered per case: what the DB stores after
 * `sanitize_reservation_pricing()` runs, or a hard constraint rejection.
 *
 * Live spec: needs SUPABASE_URL + service role key; skips itself otherwise.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const ctx = {
  service: null as unknown as SupabaseClient,
  ownerId: "",
  tenantId: "",
  otherTenantId: "",
  otherCodeId: "",
};

type PricingRow = {
  id: string;
  price_eur: number | null;
  original_price_eur: number | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_code_id: string | null;
  discount_reason: string | null;
  stall_fee: number | null;
};

const PRICING_COLUMNS =
  "id, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason, stall_fee";

const futureDate = () => new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);

const baseRow = (name: string) => ({
  tenant_id: ctx.tenantId,
  reservation_type: "restaurant",
  date: futureDate(),
  guest_name: name,
  guest_email: "ci-malformed-discount@mimmobook.test",
  status: "pending",
});

/**
 * Insert with the service role. Returns the stored row when the DB accepted
 * the payload, or `null` plus the error message when a constraint rejected it.
 */
async function insertAsService(
  payload: Record<string, unknown>,
): Promise<{ row: PricingRow | null; error: string | null }> {
  const name = `TEST CI malformed ${randomUUID().slice(0, 8)}`;
  const { data, error } = await ctx.service
    .from("reservations")
    .insert({ ...baseRow(name), ...payload })
    .select(PRICING_COLUMNS)
    .maybeSingle();
  if (error) return { row: null, error: error.message };
  return { row: (data as unknown as PricingRow) ?? null, error: null };
}

describe.runIf(canRun)(
  "reservations — malformed discount payloads via service_role (live)",
  () => {
    beforeAll(async () => {
      ctx.service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const email = `ci+malformed-${randomUUID().slice(0, 8)}@mimmobook.test`;
      const { data: userRes, error: userErr } = await ctx.service.auth.admin.createUser({
        email,
        password: `Ci-Malformed-${randomUUID()}-Z9!`,
        email_confirm: true,
      });
      if (userErr || !userRes.user) throw userErr ?? new Error("createUser failed");
      ctx.ownerId = userRes.user.id;

      const mkTenant = async (label: string): Promise<string> => {
        const id = randomUUID();
        const short = id.slice(0, 8);
        const { error } = await ctx.service.from("tenants").insert({
          id,
          name: `TEST CI ${label} ${short}`,
          slug: `ci-${label}-${short}`,
          tier: "basic",
          allowed_reservation_types: ["restaurant"],
          owner_user_id: ctx.ownerId,
          subscription_status: "trialing",
          is_active: true,
        });
        if (error) throw error;
        return id;
      };

      ctx.tenantId = await mkTenant("malformed");
      ctx.otherTenantId = await mkTenant("malformed-other");

      // A promo code owned by the OTHER tenant: must never attach here.
      const { data: code, error: codeErr } = await ctx.service
        .from("discount_codes")
        .insert({
          tenant_id: ctx.otherTenantId,
          code: `CIX${Date.now()}`.slice(0, 20).toUpperCase(),
          discount_type: "percentage",
          discount_value: 10,
          is_active: true,
        })
        .select("id")
        .single();
      if (codeErr || !code) throw codeErr ?? new Error("discount code insert failed");
      ctx.otherCodeId = code.id as string;
    }, 90_000);

    afterAll(async () => {
      if (!ctx.service) return;
      const swallow = async (p: PromiseLike<unknown>) => {
        try {
          await p;
        } catch {
          /* best-effort cleanup */
        }
      };
      for (const tenantId of [ctx.tenantId, ctx.otherTenantId].filter(Boolean)) {
        await swallow(ctx.service.from("reservations").delete().eq("tenant_id", tenantId));
        await swallow(ctx.service.from("discount_codes").delete().eq("tenant_id", tenantId));
        await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", tenantId));
        await swallow(ctx.service.from("tenants").delete().eq("id", tenantId));
      }
      if (ctx.ownerId) await swallow(ctx.service.auth.admin.deleteUser(ctx.ownerId));
    }, 90_000);

    it("keeps a well-formed server-computed discount intact (control case)", async () => {
      const { row, error } = await insertAsService({
        original_price_eur: 120,
        price_eur: 90,
        discount_type: "percentage",
        discount_value: 25,
        discount_reason: "Promo code: CIGOOD",
      });
      expect(error, `valid payload must be accepted: ${error}`).toBeNull();
      expect(Number(row?.original_price_eur)).toBe(120);
      expect(Number(row?.price_eur)).toBe(90);
      expect(row?.discount_type).toBe("percentage");
      expect(Number(row?.discount_value)).toBe(25);
      expect(row?.discount_reason).toBe("Promo code: CIGOOD");
    });

    it("drops a percentage discount above 100% and charges the gross amount", async () => {
      const { row, error } = await insertAsService({
        original_price_eur: 120,
        price_eur: 0,
        discount_type: "percentage",
        discount_value: 500,
        discount_reason: "Promo code: CIBOOM",
      });
      expect(error).toBeNull();
      expect(row?.discount_type).toBeNull();
      expect(row?.discount_value).toBeNull();
      expect(row?.discount_reason).toBeNull();
      expect(Number(row?.price_eur)).toBe(120);
      expect(Number(row?.original_price_eur)).toBe(120);
    });

    it("drops a fixed discount larger than the gross amount", async () => {
      const { row, error } = await insertAsService({
        original_price_eur: 80,
        price_eur: 0,
        discount_type: "fixed",
        discount_value: 5000,
        discount_reason: "Promo code: CIFIXED",
      });
      expect(error).toBeNull();
      expect(row?.discount_type).toBeNull();
      expect(row?.discount_value).toBeNull();
      expect(Number(row?.price_eur)).toBe(80);
    });

    it("drops a discount value with no discount type", async () => {
      const { row, error } = await insertAsService({
        original_price_eur: 60,
        price_eur: 30,
        discount_value: 50,
      });
      expect(error).toBeNull();
      expect(row?.discount_value).toBeNull();
      expect(row?.discount_type).toBeNull();
      expect(Number(row?.price_eur)).toBe(60);
    });

    it("drops a discount type with no value, and a zero-value discount", async () => {
      const noValue = await insertAsService({
        original_price_eur: 45,
        price_eur: 45,
        discount_type: "percentage",
        discount_reason: "Promo code: CIEMPTY",
      });
      expect(noValue.error).toBeNull();
      expect(noValue.row?.discount_type).toBeNull();
      expect(noValue.row?.discount_reason).toBeNull();

      const zeroValue = await insertAsService({
        original_price_eur: 45,
        price_eur: 45,
        discount_type: "fixed",
        discount_value: 0,
      });
      expect(zeroValue.error).toBeNull();
      expect(zeroValue.row?.discount_type).toBeNull();
      expect(zeroValue.row?.discount_value).toBeNull();
    });

    it("detaches a promo code that belongs to another tenant", async () => {
      const { row, error } = await insertAsService({
        original_price_eur: 100,
        price_eur: 90,
        discount_type: "percentage",
        discount_value: 10,
        discount_code_id: ctx.otherCodeId,
        discount_reason: "Promo code: CIX",
      });
      expect(error).toBeNull();
      expect(row?.discount_code_id).toBeNull();
      // The rest of the (otherwise valid) discount survives.
      expect(row?.discount_type).toBe("percentage");
      expect(Number(row?.price_eur)).toBe(90);
    });

    it("detaches a promo code id that does not exist", async () => {
      const { row, error } = await insertAsService({
        original_price_eur: 100,
        price_eur: 95,
        discount_type: "fixed",
        discount_value: 5,
        discount_code_id: randomUUID(),
      });
      // Either the FK rejects it or the trigger clears it: both are safe.
      if (error) {
        expect(error).toMatch(/foreign key|violates/i);
      } else {
        expect(row?.discount_code_id).toBeNull();
      }
    });

    it("drops non-finite money values instead of storing NaN or Infinity", async () => {
      const nan = await insertAsService({
        price_eur: "NaN",
        original_price_eur: "NaN",
        discount_type: "percentage",
        discount_value: "NaN",
        stall_fee: "NaN",
      });
      expect(nan.error).toBeNull();
      expect(nan.row?.price_eur).toBeNull();
      expect(nan.row?.original_price_eur).toBeNull();
      expect(nan.row?.discount_value).toBeNull();
      expect(nan.row?.discount_type).toBeNull();
      expect(nan.row?.stall_fee).toBeNull();

      const inf = await insertAsService({
        price_eur: "Infinity",
        original_price_eur: "-Infinity",
      });
      expect(inf.error).toBeNull();
      expect(inf.row?.price_eur).toBeNull();
      expect(inf.row?.original_price_eur).toBeNull();
    });

    it("never stores a gross amount below the final price", async () => {
      const { row, error } = await insertAsService({
        original_price_eur: 10,
        price_eur: 250,
      });
      expect(error).toBeNull();
      expect(Number(row?.price_eur)).toBe(250);
      expect(Number(row?.original_price_eur)).toBe(250);
    });

    it("rejects negative money and unknown discount types, scrubbing negative discounts", async () => {
      const negative = await insertAsService({ price_eur: -50, original_price_eur: -10 });
      expect(negative.error, "negative prices must be rejected").toBeTruthy();

      // A negative discount is not a rejection case: the trigger clears the
      // whole discount payload first, so the row lands with the gross amount.
      const negativeDiscount = await insertAsService({
        original_price_eur: 100,
        price_eur: 100,
        discount_type: "percentage",
        discount_value: -25,
      });
      expect(negativeDiscount.error).toBeNull();
      expect(negativeDiscount.row?.discount_type).toBeNull();
      expect(negativeDiscount.row?.discount_value).toBeNull();
      expect(Number(negativeDiscount.row?.price_eur)).toBe(100);


      const unknownType = await insertAsService({
        original_price_eur: 100,
        price_eur: 50,
        discount_type: "definitely-not-a-type",
        discount_value: 50,
      });
      expect(unknownType.error, "unknown discount type must be rejected").toBeTruthy();
    });

    it("scrubs malformed discount payloads on update too", async () => {
      const created = await insertAsService({
        original_price_eur: 200,
        price_eur: 150,
        discount_type: "percentage",
        discount_value: 25,
        discount_reason: "Promo code: CIUPD",
      });
      expect(created.error).toBeNull();
      const id = created.row!.id;

      const { data, error } = await ctx.service
        .from("reservations")
        .update({ discount_type: "percentage", discount_value: 900, price_eur: 1 })
        .eq("id", id)
        .select(PRICING_COLUMNS)
        .single();
      expect(error, error?.message).toBeNull();
      const updated = data as unknown as PricingRow;
      expect(updated.discount_type).toBeNull();
      expect(updated.discount_value).toBeNull();
      expect(updated.discount_reason).toBeNull();
      expect(Number(updated.price_eur)).toBe(200);
      expect(Number(updated.original_price_eur)).toBe(200);
    });
  },
);
