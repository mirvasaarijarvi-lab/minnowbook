/**
 * Anon reservation insert — malformed / partial discount payload matrix.
 *
 * The RLS INSERT policy on `public.reservations` (fixed under
 * `reservations_anon_insert_discount_bypass`) forces the three discount
 * columns to NULL for anonymous callers. This suite locks that invariant
 * against every variation an attacker might try:
 *
 *   • single-field partial payloads (only one of the three set)
 *   • two-field partial payloads (every pair)
 *   • all three fields with conflicting types/values
 *   • malformed discount_code_id (non-UUID, empty string, sentinel UUIDs)
 *   • non-existent but well-formed discount_code_id
 *   • cross-tenant discount_code_id (belongs to another tenant)
 *   • hostile numeric values (negative, zero, absurdly large, NaN via string)
 *   • unknown discount_type strings
 *
 * A clean payload (all three NULL) is asserted as the control so a
 * regression that widens the block into a full-shape reject is caught.
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
  otherTenantId: string;
  ownerId: string;
  otherOwnerId: string;
  ownDiscountId: string;
  otherDiscountId: string;
  cleanupTenants: string[];
  cleanupUsers: string[];
  cleanupReservationIds: string[];
}

const ctx: Ctx = {
  service: null as unknown as SupabaseClient,
  tenantId: "",
  otherTenantId: "",
  ownerId: "",
  otherOwnerId: "",
  ownDiscountId: "",
  otherDiscountId: "",
  cleanupTenants: [],
  cleanupUsers: [],
  cleanupReservationIds: [],
};

async function createOwner(label: string): Promise<string> {
  const email = `ci+disc-${label}-${randomUUID().slice(0, 8)}@mimmobook.test`;
  const password = `Ci-Disc-${randomUUID()}-Z9!`;
  const { data, error } = await ctx.service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  ctx.cleanupUsers.push(data.user.id);
  return data.user.id;
}

async function createTenant(ownerUserId: string, label: string): Promise<string> {
  const tenantId = randomUUID();
  const shortId = tenantId.slice(0, 8);
  const { error } = await ctx.service.from("tenants").insert({
    id: tenantId,
    name: `TEST CI disc ${label} ${shortId}`,
    slug: `ci-disc-${label}-${shortId}`,
    tier: "basic",
    allowed_reservation_types: ["restaurant"],
    owner_user_id: ownerUserId,
    subscription_status: "trialing",
    is_active: true,
  });
  if (error) throw error;
  ctx.cleanupTenants.push(tenantId);
  const { error: tuErr } = await ctx.service.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: ownerUserId,
    role: "owner",
    is_approved: true,
  });
  if (tuErr) throw tuErr;
  return tenantId;
}

async function createDiscount(tenantId: string, code: string): Promise<string> {
  const { data, error } = await ctx.service
    .from("discount_codes")
    .insert({
      tenant_id: tenantId,
      code,
      discount_type: "percent",
      discount_value: 10,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("discount insert failed");
  return data.id;
}

const buildBase = () => ({
  tenant_id: ctx.tenantId,
  reservation_type: "restaurant",
  date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  guest_name: `TEST CI disc ${randomUUID().slice(0, 8)}`,
  guest_email: "ci-disc@mimmobook.test",
  status: "pending",
});

describe.runIf(canRun)("anon reservation insert — malformed discount payloads (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();
    ctx.ownerId = await createOwner("primary");
    ctx.tenantId = await createTenant(ctx.ownerId, "primary");
    ctx.otherOwnerId = await createOwner("other");
    ctx.otherTenantId = await createTenant(ctx.otherOwnerId, "other");
    ctx.ownDiscountId = await createDiscount(ctx.tenantId, `OWN${randomUUID().slice(0, 6).toUpperCase()}`);
    ctx.otherDiscountId = await createDiscount(
      ctx.otherTenantId,
      `OTH${randomUUID().slice(0, 6).toUpperCase()}`,
    );
  }, 60_000);

  afterAll(async () => {
    if (!ctx.service) return;
    const swallow = async (p: PromiseLike<unknown>) => {
      try { await p; } catch { /* best-effort */ }
    };
    if (ctx.cleanupReservationIds.length) {
      await swallow(
        ctx.service.from("reservations").delete().in("id", ctx.cleanupReservationIds),
      );
    }
    for (const t of ctx.cleanupTenants) {
      await swallow(ctx.service.from("reservations").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("discount_codes").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenants").delete().eq("id", t));
    }
    for (const u of ctx.cleanupUsers) {
      await swallow(ctx.service.auth.admin.deleteUser(u));
    }
  }, 60_000);

  // Helper: an insert must either error, OR the returned row must have
  // all three discount columns forced to NULL (defense-in-depth: if the
  // policy is later relaxed to WITH CHECK-scrub instead of reject, the
  // invariant still holds — no discount ever attaches for anon).
  async function assertAnonInsertBlocksDiscount(
    payload: Record<string, unknown>,
    label: string,
  ) {
    const anon = newAnon();
    const { data, error } = await anon
      .from("reservations")
      .insert({ ...buildBase(), ...payload })
      .select("id, discount_code_id, discount_type, discount_value");

    if (error) {
      // Rejection path — nothing more to check.
      return;
    }
    // Silent-scrub path: row was inserted but discount fields must be NULL.
    expect(data, `${label}: expected rejection or scrubbed row`).toBeTruthy();
    expect(data!.length, `${label}: exactly one row`).toBe(1);
    const row = data![0];
    expect(row.discount_code_id, `${label}: discount_code_id must be NULL`).toBeNull();
    expect(row.discount_type, `${label}: discount_type must be NULL`).toBeNull();
    expect(row.discount_value, `${label}: discount_value must be NULL`).toBeNull();
    ctx.cleanupReservationIds.push(row.id);
  }

  // ─── Control ───────────────────────────────────────────────────────
  it("clean payload with no discount fields is accepted", async () => {
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
    if (data?.id) ctx.cleanupReservationIds.push(data.id);
  });

  // ─── Single-field partial payloads ─────────────────────────────────
  describe("single discount field", () => {
    it.each([
      ["discount_code_id (own tenant)", { discount_code_id: () => ctx.ownDiscountId }],
      ["discount_code_id (other tenant)", { discount_code_id: () => ctx.otherDiscountId }],
      ["discount_code_id (well-formed but non-existent)", { discount_code_id: () => randomUUID() }],
      ["discount_type only", { discount_type: () => "percent" }],
      ["discount_value only", { discount_value: () => 10 }],
    ] as const)("rejects/scrubs %s", async (label, spec) => {
      const payload = Object.fromEntries(
        Object.entries(spec).map(([k, v]) => [k, (v as () => unknown)()]),
      );
      await assertAnonInsertBlocksDiscount(payload, label);
    });
  });

  // ─── Two-field partial payloads (every pair) ───────────────────────
  describe("two discount fields", () => {
    it.each([
      ["code_id + type", () => ({ discount_code_id: ctx.ownDiscountId, discount_type: "percent" })],
      ["code_id + value", () => ({ discount_code_id: ctx.ownDiscountId, discount_value: 10 })],
      ["type + value", () => ({ discount_type: "fixed", discount_value: 5 })],
    ] as const)("rejects/scrubs %s", async (label, build) => {
      await assertAnonInsertBlocksDiscount(build(), label);
    });
  });

  // ─── Full triple with conflicting values ───────────────────────────
  describe("all three fields with conflicts", () => {
    it("type says percent but value is fixed-shaped", async () => {
      await assertAnonInsertBlocksDiscount(
        { discount_code_id: ctx.ownDiscountId, discount_type: "percent", discount_value: 250 },
        "percent+250",
      );
    });
    it("type says fixed but value is percent-shaped", async () => {
      await assertAnonInsertBlocksDiscount(
        { discount_code_id: ctx.ownDiscountId, discount_type: "fixed", discount_value: 0.05 },
        "fixed+0.05",
      );
    });
    it("code_id from other tenant with plausible type/value", async () => {
      await assertAnonInsertBlocksDiscount(
        { discount_code_id: ctx.otherDiscountId, discount_type: "percent", discount_value: 10 },
        "cross-tenant triple",
      );
    });
  });

  // ─── Malformed discount_code_id shapes ─────────────────────────────
  describe("malformed discount_code_id", () => {
    it.each([
      ["non-uuid string", "not-a-uuid"],
      ["empty string", ""],
      ["all-zero uuid", "00000000-0000-0000-0000-000000000000"],
      ["all-f uuid", "ffffffff-ffff-ffff-ffff-ffffffffffff"],
    ])("rejects/scrubs %s", async (label, id) => {
      // Non-UUID strings should trigger a type error at PostgREST/PG level;
      // valid-shape sentinels should either be rejected by policy or
      // silently scrubbed by our defense-in-depth helper.
      const anon = newAnon();
      const { data, error } = await anon
        .from("reservations")
        .insert({ ...buildBase(), discount_code_id: id })
        .select("id, discount_code_id, discount_type, discount_value");
      if (error) return;
      // If it somehow inserted, discount_code_id MUST be NULL.
      expect(data, `${label}: expected row scrub if not rejected`).toBeTruthy();
      expect(data![0].discount_code_id, `${label}: must be NULL`).toBeNull();
      ctx.cleanupReservationIds.push(data![0].id);
    });
  });

  // ─── Hostile discount_value values ─────────────────────────────────
  describe("hostile discount_value", () => {
    it.each([
      ["negative", -50],
      ["zero", 0],
      ["absurdly large", 9_999_999],
      ["fractional percent overflow", 1000.5],
    ])("rejects/scrubs %s", async (label, value) => {
      await assertAnonInsertBlocksDiscount({ discount_value: value }, `value=${label}`);
    });
  });

  // ─── Unknown discount_type strings ─────────────────────────────────
  describe("unknown discount_type", () => {
    it.each([
      ["empty string", ""],
      ["random word", "freebie"],
      ["sql-ish", "'; DROP TABLE reservations; --"],
      ["mixed case", "PeRcEnT"],
    ])("rejects/scrubs %s", async (label, type) => {
      await assertAnonInsertBlocksDiscount({ discount_type: type }, `type=${label}`);
    });
  });
});
