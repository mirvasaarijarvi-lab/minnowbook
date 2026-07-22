/**
 * Regression: the public `reservations` INSERT policy for anon must
 * force every staff-only column to its NULL/default value.
 *
 * Locked down under `reservations_public_insert_review`. The WITH CHECK
 * clause on "Public can create reservations for active tenants" scrubs
 * pricing, discount metadata, invoicing, notes, created_by, and the
 * outbound email timestamps. This suite exercises each field in turn
 * so a future policy relaxation can't silently reintroduce escalation.
 *
 * The assertion pattern mirrors the malformed-discount suite:
 *   - explicit rejection is acceptable
 *   - silent scrub (row inserted, sensitive field forced to NULL/false)
 *     is also acceptable — defense-in-depth
 *   - what is NEVER acceptable is the attacker-supplied value landing
 *     on the row
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
  ownerId: string;
  tenantId: string;
  cleanupTenants: string[];
  cleanupUsers: string[];
  cleanupReservationIds: string[];
}

const ctx: Ctx = {
  service: null as unknown as SupabaseClient,
  ownerId: "",
  tenantId: "",
  cleanupTenants: [],
  cleanupUsers: [],
  cleanupReservationIds: [],
};

const buildBase = () => ({
  tenant_id: ctx.tenantId,
  reservation_type: "restaurant",
  date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  guest_name: `TEST CI staff-only ${randomUUID().slice(0, 8)}`,
  guest_email: "ci-staff-only@mimmobook.test",
  status: "pending",
});

/**
 * List of staff-only fields with a hostile value and the property that
 * must remain unchanged after the insert. `expected` is what the row
 * SHOULD contain (either NULL/default or a scrubbed value); `mustNotEqual`
 * documents the attacker-supplied value that must never persist.
 */
const STAFF_ONLY_CASES: Array<{
  field: string;
  hostile: unknown;
  mustNotEqual: unknown;
}> = [
  { field: "price_eur", hostile: 0.01, mustNotEqual: 0.01 },
  { field: "original_price_eur", hostile: 0.01, mustNotEqual: 0.01 },
  { field: "pricing_details", hostile: "attacker-supplied pricing", mustNotEqual: "attacker-supplied pricing" },
  { field: "staff_notes", hostile: "SHOULD_NOT_APPEAR_staff", mustNotEqual: "SHOULD_NOT_APPEAR_staff" },
  { field: "internal_notes", hostile: "SHOULD_NOT_APPEAR_internal", mustNotEqual: "SHOULD_NOT_APPEAR_internal" },
  { field: "discount_reason", hostile: "free-because-i-said-so", mustNotEqual: "free-because-i-said-so" },
  { field: "is_invoiced", hostile: true, mustNotEqual: true },
  { field: "created_by", hostile: "00000000-0000-0000-0000-000000000001", mustNotEqual: "00000000-0000-0000-0000-000000000001" },
  { field: "acknowledgment_email_sent_at", hostile: "2099-01-01T00:00:00Z", mustNotEqual: "2099-01-01T00:00:00Z" },
  { field: "confirmation_email_sent_at", hostile: "2099-01-01T00:00:00Z", mustNotEqual: "2099-01-01T00:00:00Z" },
  { field: "cancellation_email_sent_at", hostile: "2099-01-01T00:00:00Z", mustNotEqual: "2099-01-01T00:00:00Z" },
  { field: "reminder_email_sent_at", hostile: "2099-01-01T00:00:00Z", mustNotEqual: "2099-01-01T00:00:00Z" },
];

describe.runIf(canRun)("anon reservation insert — staff-only fields scrubbed (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();

    const email = `ci+resv-${randomUUID().slice(0, 8)}@mimmobook.test`;
    const password = `Ci-Resv-${randomUUID()}-Z9!`;
    const { data: userRes, error: userErr } = await ctx.service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userErr || !userRes.user) throw userErr ?? new Error("createUser failed");
    ctx.ownerId = userRes.user.id;
    ctx.cleanupUsers.push(ctx.ownerId);

    const tenantId = randomUUID();
    const shortId = tenantId.slice(0, 8);
    const { error: tErr } = await ctx.service.from("tenants").insert({
      id: tenantId,
      name: `TEST CI resv-scrub ${shortId}`,
      slug: `ci-resv-scrub-${shortId}`,
      tier: "basic",
      allowed_reservation_types: ["restaurant"],
      owner_user_id: ctx.ownerId,
      subscription_status: "trialing",
      is_active: true,
    });
    if (tErr) throw tErr;
    ctx.tenantId = tenantId;
    ctx.cleanupTenants.push(tenantId);

    await ctx.service.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: ctx.ownerId,
      role: "owner",
      is_approved: true,
    });
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
      await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenants").delete().eq("id", t));
    }
    for (const u of ctx.cleanupUsers) {
      await swallow(ctx.service.auth.admin.deleteUser(u));
    }
  }, 60_000);

  // Control: clean payload succeeds and leaves staff-only fields at
  // their default/NULL state. This catches over-blocking regressions.
  it("clean payload is accepted with all staff-only fields at defaults", async () => {
    const anon = newAnon();
    const { data, error } = await anon
      .from("reservations")
      .insert(buildBase())
      .select(
        "id, price_eur, original_price_eur, pricing_details, staff_notes, internal_notes, discount_reason, is_invoiced, created_by, acknowledgment_email_sent_at, confirmation_email_sent_at, cancellation_email_sent_at, reminder_email_sent_at",
      )
      .single();
    expect(error, `control insert must succeed: ${error?.message}`).toBeNull();
    expect(data).toBeTruthy();
    if (!data) return;
    ctx.cleanupReservationIds.push(data.id);
    expect(data.price_eur).toBeNull();
    expect(data.original_price_eur).toBeNull();
    expect(data.pricing_details).toBeNull();
    expect(data.staff_notes).toBeNull();
    expect(data.internal_notes).toBeNull();
    expect(data.discount_reason).toBeNull();
    expect(data.is_invoiced).toBe(false);
    expect(data.created_by).toBeNull();
    expect(data.acknowledgment_email_sent_at).toBeNull();
    expect(data.confirmation_email_sent_at).toBeNull();
    expect(data.cancellation_email_sent_at).toBeNull();
    expect(data.reminder_email_sent_at).toBeNull();
  });

  it.each(STAFF_ONLY_CASES)(
    "anon cannot set $field",
    async ({ field, hostile, mustNotEqual }) => {
      const anon = newAnon();
      const payload = { ...buildBase(), [field]: hostile };
      const { data, error } = await anon
        .from("reservations")
        .insert(payload)
        .select(`id, ${field}`);

      // Rejection is a valid outcome.
      if (error) {
        expect(error.message).toBeTruthy();
        return;
      }

      // Silent-scrub path — row inserted but field must not carry the hostile value.
      expect(data, `${field}: expected rejection or scrubbed row`).toBeTruthy();
      expect(data!.length, `${field}: exactly one row`).toBe(1);
      const row = data![0] as Record<string, unknown>;
      ctx.cleanupReservationIds.push(row.id as string);
      expect(
        row[field],
        `${field}: attacker-supplied value (${JSON.stringify(hostile)}) must not persist`,
      ).not.toEqual(mustNotEqual);
    },
  );

  it("anon cannot bulk-set every staff-only field in one payload", async () => {
    const anon = newAnon();
    const hostilePayload: Record<string, unknown> = { ...buildBase() };
    for (const c of STAFF_ONLY_CASES) hostilePayload[c.field] = c.hostile;

    const selectCols = ["id", ...STAFF_ONLY_CASES.map((c) => c.field)].join(", ");
    const { data, error } = await anon
      .from("reservations")
      .insert(hostilePayload)
      .select(selectCols);

    if (error) {
      expect(error.message).toBeTruthy();
      return;
    }
    expect(data).toBeTruthy();
    expect(data!.length).toBe(1);
    const row = data![0] as Record<string, unknown>;
    ctx.cleanupReservationIds.push(row.id as string);
    for (const c of STAFF_ONLY_CASES) {
      expect(
        row[c.field],
        `bulk: ${c.field} must not equal attacker value ${JSON.stringify(c.hostile)}`,
      ).not.toEqual(c.mustNotEqual);
    }
  });
});
