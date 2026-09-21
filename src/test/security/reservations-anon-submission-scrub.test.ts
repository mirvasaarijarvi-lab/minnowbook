/**
 * Regression: an anonymous visitor CAN submit a booking, but can never
 * decide money, discounts, staff-owned notes, or the booking's status.
 *
 * Complements `reservations-anon-staff-only-fields.test.ts` (per-field
 * scrub) and `reservations-anon-discount-malformed.test.ts` (malformed
 * discount payloads) by covering the two gaps:
 *
 *   1. the positive path — a clean public submission is accepted and
 *      lands as a `pending` request with no pricing attached;
 *   2. `status` escalation — an anon insert claiming `confirmed` /
 *      `cancelled` / `completed` must never persist that status.
 *
 * Accepted outcomes for a hostile payload:
 *   - explicit rejection, or
 *   - silent scrub (row inserted, hostile value forced to the safe value).
 * Never acceptable: the attacker-supplied value persisting on the row.
 *
 * Live-only: needs a real anon key plus the service role for setup,
 * read-back (anon has no SELECT on reservations by design), and teardown.
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

const futureDate = () =>
  new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);

const buildSubmission = (label: string) => ({
  tenant_id: ctx.tenantId,
  reservation_type: "restaurant",
  date: futureDate(),
  start_time: "18:30",
  guest_name: `TEST CI anon-submit ${label} ${randomUUID().slice(0, 8)}`,
  guest_email: "ci-anon-submit@mimmobook.test",
  guest_phone: "+358401234567",
  guests_count: 2,
  special_requests: "Window table if possible",
  language: "en",
});

/** Read a submitted row back with the service role. */
async function readBack(guestName: string, columns: string) {
  const { data, error } = await ctx.service
    .from("reservations")
    .select(columns)
    .eq("tenant_id", ctx.tenantId)
    .eq("guest_name", guestName)
    .maybeSingle();
  return { row: data as unknown as Record<string, unknown> | null, error };
}

describe.runIf(canRun)(
  "anon booking submission — accepted but never priced, discounted, annotated, or self-confirmed (live)",
  () => {
    beforeAll(async () => {
      ctx.service = newService();

      const email = `ci+anon-submit-${randomUUID().slice(0, 8)}@mimmobook.test`;
      const { data: userRes, error: userErr } =
        await ctx.service.auth.admin.createUser({
          email,
          password: `Ci-Submit-${randomUUID()}-Z9!`,
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
        name: `TEST CI anon-submit ${shortId}`,
        slug: `ci-anon-submit-${shortId}`,
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

    it("accepts a clean public submission and stores it as an unpriced pending request", async () => {
      const payload = buildSubmission("clean");
      const { error } = await newAnon().from("reservations").insert(payload);
      expect(
        error,
        `public submission must succeed: ${error?.message}`,
      ).toBeNull();

      const { row, error: readErr } = await readBack(
        payload.guest_name,
        [
          "id",
          "status",
          "guest_name",
          "guest_email",
          "guests_count",
          "special_requests",
          "price_eur",
          "original_price_eur",
          "pricing_details",
          "discount_type",
          "discount_value",
          "discount_code_id",
          "discount_reason",
          "staff_notes",
          "internal_notes",
          "is_invoiced",
          "is_checked_in",
          "is_used",
          "created_by",
        ].join(", "),
      );
      expect(readErr, `read-back must succeed: ${readErr?.message}`).toBeNull();
      expect(row).toBeTruthy();
      if (!row) return;

      // Guest-owned fields survive: the booking is genuinely usable.
      expect(row.guest_email).toBe(payload.guest_email);
      expect(row.guests_count).toBe(payload.guests_count);
      expect(row.special_requests).toBe(payload.special_requests);

      // Everything staff- or server-owned stays untouched.
      expect(row.status).toBe("pending");
      expect(row.price_eur).toBeNull();
      expect(row.original_price_eur).toBeNull();
      expect(row.pricing_details).toBeNull();
      expect(row.discount_type).toBeNull();
      expect(row.discount_value).toBeNull();
      expect(row.discount_code_id).toBeNull();
      expect(row.discount_reason).toBeNull();
      expect(row.staff_notes).toBeNull();
      expect(row.internal_notes).toBeNull();
      expect(row.is_invoiced).toBe(false);
      expect(row.is_checked_in).toBe(false);
      expect(row.is_used).toBe(false);
      expect(row.created_by).toBeNull();
    });

    it.each(["confirmed", "cancelled", "completed", "no_show"])(
      "anon cannot self-assign status=%s",
      async (status) => {
        const payload = { ...buildSubmission(`status-${status}`), status };
        const { error } = await newAnon().from("reservations").insert(payload);
        if (error) {
          expect(error.message).toBeTruthy();
          return;
        }
        const { row } = await readBack(payload.guest_name, "id, status");
        expect(
          row,
          `status=${status}: row expected after accepted insert`,
        ).toBeTruthy();
        expect(row?.status, `status=${status} must not persist`).not.toBe(
          status,
        );
        expect(row?.status).toBe("pending");
      },
    );

    it("anon cannot price, discount, or annotate a booking it submits", async () => {
      const payload = {
        ...buildSubmission("hostile-bundle"),
        status: "confirmed",
        price_eur: 0,
        original_price_eur: 0,
        pricing_details: "free for me",
        discount_type: "percentage",
        discount_value: 100,
        discount_reason: "self-granted",
        staff_notes: "SHOULD_NOT_APPEAR_staff",
        internal_notes: "SHOULD_NOT_APPEAR_internal",
        is_invoiced: true,
        is_checked_in: true,
        is_used: true,
        created_by: "00000000-0000-0000-0000-000000000001",
      };
      const { error } = await newAnon().from("reservations").insert(payload);
      if (error) {
        expect(error.message).toBeTruthy();
        return;
      }

      const { row } = await readBack(
        payload.guest_name,
        [
          "id",
          "status",
          "price_eur",
          "original_price_eur",
          "pricing_details",
          "discount_type",
          "discount_value",
          "discount_reason",
          "staff_notes",
          "internal_notes",
          "is_invoiced",
          "is_checked_in",
          "is_used",
          "created_by",
        ].join(", "),
      );
      expect(row).toBeTruthy();
      if (!row) return;

      expect(row.status).toBe("pending");
      expect(row.price_eur).toBeNull();
      expect(row.original_price_eur).toBeNull();
      expect(row.pricing_details).toBeNull();
      expect(row.discount_type).toBeNull();
      expect(row.discount_value).toBeNull();
      expect(row.discount_reason).toBeNull();
      expect(row.staff_notes).toBeNull();
      expect(row.internal_notes).toBeNull();
      expect(row.is_invoiced).toBe(false);
      expect(row.is_checked_in).toBe(false);
      expect(row.is_used).toBe(false);
      expect(row.created_by).toBeNull();
    });

    it("a scrubbed hostile submission is still a working booking request", async () => {
      const payload = {
        ...buildSubmission("still-usable"),
        price_eur: 1,
        staff_notes: "SHOULD_NOT_APPEAR_staff",
      };
      const { error } = await newAnon().from("reservations").insert(payload);
      if (error) {
        // Rejection is acceptable; nothing further to assert.
        expect(error.message).toBeTruthy();
        return;
      }
      const { row } = await readBack(
        payload.guest_name,
        "id, status, guest_email, date, start_time, guests_count",
      );
      expect(row).toBeTruthy();
      expect(row?.status).toBe("pending");
      expect(row?.guest_email).toBe(payload.guest_email);
      expect(row?.guests_count).toBe(payload.guests_count);
      expect(String(row?.date)).toBe(payload.date);
    });
  },
);
