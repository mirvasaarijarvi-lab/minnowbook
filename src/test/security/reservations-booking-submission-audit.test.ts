/**
 * Regression: every booking submitted through a non-authenticated path
 * writes an `audit_log` entry with action `booking_submission`, recording
 * the caller context, the fields the system assigned, and any
 * caller-supplied staff/pricing values that were discarded.
 *
 * Covers `log_booking_submission()` called from
 * `validate_public_reservation_insert()`.
 *
 * Live-only: needs a real anon key plus the service role for setup,
 * audit read-back (audit_log is never anon-readable), and teardown.
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
}

const ctx: Ctx = {
  service: null as unknown as SupabaseClient,
  ownerId: "",
  tenantId: "",
  cleanupTenants: [],
  cleanupUsers: [],
};

const buildSubmission = (label: string) => ({
  tenant_id: ctx.tenantId,
  reservation_type: "restaurant",
  date: new Date(Date.now() + 11 * 86_400_000).toISOString().slice(0, 10),
  start_time: "19:00",
  guest_name: `TEST CI submit-audit ${label} ${randomUUID().slice(0, 8)}`,
  guest_email: "ci-submit-audit@mimmobook.test",
  guests_count: 2,
});

type AuditRow = {
  id: string;
  action: string;
  record_id: string | null;
  summary: string | null;
  new_data: Record<string, unknown> | null;
};

async function reservationIdFor(guestName: string): Promise<string | null> {
  const { data } = await ctx.service
    .from("reservations")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("guest_name", guestName)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function submissionAuditFor(
  reservationId: string,
): Promise<AuditRow | null> {
  const { data } = await ctx.service
    .from("audit_log")
    .select("id, action, record_id, summary, new_data")
    .eq("tenant_id", ctx.tenantId)
    .eq("action", "booking_submission")
    .eq("record_id", reservationId)
    .maybeSingle();
  return (data as AuditRow | null) ?? null;
}

describe.runIf(canRun)("booking submission audit trail (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();

    const { data: userRes, error: userErr } =
      await ctx.service.auth.admin.createUser({
        email: `ci+submit-audit-${randomUUID().slice(0, 8)}@mimmobook.test`,
        password: `Ci-Audit-${randomUUID()}-Z9!`,
        email_confirm: true,
      });
    if (userErr || !userRes.user)
      throw userErr ?? new Error("createUser failed");
    ctx.ownerId = userRes.user.id;
    ctx.cleanupUsers.push(ctx.ownerId);

    const tenantId = randomUUID();
    const shortId = tenantId.slice(0, 8);
    const { error: tErr } = await ctx.service.from("tenants").insert({
      id: tenantId,
      name: `TEST CI submit-audit ${shortId}`,
      slug: `ci-submit-audit-${shortId}`,
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
      try {
        await p;
      } catch {
        /* best-effort */
      }
    };
    for (const t of ctx.cleanupTenants) {
      await swallow(ctx.service.from("audit_log").delete().eq("tenant_id", t));
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
  }, 60_000);

  it("records a clean public submission with the system-assigned values", async () => {
    const payload = buildSubmission("clean");
    const { error } = await newAnon().from("reservations").insert(payload);
    expect(error, `submission must succeed: ${error?.message}`).toBeNull();

    const reservationId = await reservationIdFor(payload.guest_name);
    expect(reservationId).toBeTruthy();
    const entry = await submissionAuditFor(reservationId!);
    expect(entry, "booking_submission audit entry must exist").toBeTruthy();
    if (!entry) return;

    const data = entry.new_data ?? {};
    expect(data.source).toBe("public_form");
    expect(data.trusted).toBe(false);
    const assigned = data.system_assigned as Record<string, unknown>;
    expect(assigned).toBeTruthy();
    expect(assigned.status).toBe("pending");
    expect(assigned.is_invoiced).toBe(false);
    expect(assigned.is_checked_in).toBe(false);
    expect(assigned.price_eur).toBeNull();
    expect(assigned.discount_type).toBeNull();
    expect(assigned.staff_notes).toBeNull();
    expect(assigned.created_by).toBeNull();
    expect(data.discarded_fields).toEqual([]);
  });

  it("records every discarded staff-owned field an anonymous caller tried to set", async () => {
    const payload = {
      ...buildSubmission("hostile"),
      status: "confirmed",
      price_eur: 0,
      discount_type: "percentage",
      discount_value: 100,
      staff_notes: "SHOULD_NOT_APPEAR_staff",
      internal_notes: "SHOULD_NOT_APPEAR_internal",
      is_invoiced: true,
    };
    const { error } = await newAnon().from("reservations").insert(payload);
    expect(error, `submission must succeed: ${error?.message}`).toBeNull();

    const reservationId = await reservationIdFor(payload.guest_name);
    expect(reservationId).toBeTruthy();
    const entry = await submissionAuditFor(reservationId!);
    expect(entry).toBeTruthy();
    if (!entry) return;

    const data = entry.new_data ?? {};
    const discarded = (data.discarded_fields as string[]) ?? [];
    for (const field of [
      "price_eur",
      "discount_type",
      "discount_value",
      "status",
      "is_invoiced",
      "staff_notes",
      "internal_notes",
    ]) {
      expect(discarded, `${field} must be recorded as discarded`).toContain(
        field,
      );
    }
    // The submitted (rejected) values are preserved for review.
    const submitted = data.submitted_values as Record<string, unknown>;
    expect(submitted.status).toBe("confirmed");
    expect(Number(submitted.discount_value)).toBe(100);
    // ...but the stored row still carries the safe values.
    const { data: row } = await ctx.service
      .from("reservations")
      .select("status, price_eur, staff_notes, is_invoiced")
      .eq("id", reservationId!)
      .maybeSingle();
    const stored = row as Record<string, unknown> | null;
    expect(stored?.status).toBe("pending");
    expect(stored?.price_eur).toBeNull();
    expect(stored?.staff_notes).toBeNull();
    expect(stored?.is_invoiced).toBe(false);
  });

  it("records a trusted server-side submission as source=server", async () => {
    const payload = {
      ...buildSubmission("server"),
      price_eur: 120,
      original_price_eur: 120,
    };
    const { error } = await ctx.service.from("reservations").insert(payload);
    expect(error, `server insert must succeed: ${error?.message}`).toBeNull();

    const reservationId = await reservationIdFor(payload.guest_name);
    expect(reservationId).toBeTruthy();
    const entry = await submissionAuditFor(reservationId!);
    expect(entry).toBeTruthy();
    const data = entry?.new_data ?? {};
    expect(data.source).toBe("server");
    expect(data.trusted).toBe(true);
    expect(data.discarded_fields).toEqual([]);
    expect((data.system_assigned as Record<string, unknown>) ?? {}).toEqual({});
  });

  it("never exposes booking_submission entries to anonymous callers", async () => {
    const anon = newAnon();
    const { data, error } = await anon
      .from("audit_log")
      .select("id, action, new_data")
      .eq("action", "booking_submission")
      .limit(5);
    if (error) {
      expect(error.message).toBeTruthy();
      return;
    }
    expect(data ?? []).toHaveLength(0);
  });
});
