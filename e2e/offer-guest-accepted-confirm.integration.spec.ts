import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
  makeTestGuest,
} from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeOfferMainReservation } from "../src/lib/offer-confirm";

/**
 * Integration tests against the test database: confirming a guest-accepted
 * offer must leave the guest with EXACTLY ONE main reservation.
 *
 *  A. Offer with no originating booking: Confirm creates one new reservation.
 *  B. Offer made from an existing booking: Confirm updates that booking in
 *     place; no second reservation is created.
 *
 * Uses the same writer the Offers page uses (writeOfferMainReservation), with
 * a real signed-in staff client so RLS and triggers apply. Guest acceptance is
 * simulated by setting guest_accepted_at, as the guest acceptance flow does.
 *
 * Skipped unless staff credentials for the shared test tenant are set:
 *   E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD
 */
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;

async function staffClient(): Promise<SupabaseClient> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await sb.auth.signInWithPassword({
    email: STAFF_EMAIL!,
    password: STAFF_PASSWORD!,
  });
  expect(error, error?.message).toBeNull();
  return sb;
}

async function reservationsFor(
  sb: SupabaseClient,
  tenantId: string,
  email: string,
) {
  const { data, error } = await sb
    .from("reservations")
    .select("id,status,date,guests_count,linked_group_id,staff_notes")
    .eq("tenant_id", tenantId)
    .eq("guest_email", email);
  expect(error, error?.message).toBeNull();
  return data ?? [];
}

async function acceptedOffer(
  sb: SupabaseClient,
  tenantId: string,
  guest: ReturnType<typeof makeTestGuest>,
  extra: Record<string, unknown> = {},
) {
  const { data, error } = await sb
    .from("offers")
    .insert({
      tenant_id: tenantId,
      status: "sent",
      ...guest,
      event_date: futureDate(60),
      start_time: "18:00",
      end_time: "22:00",
      guests_count: 20,
      event_space: "TEST space",
      language: "en",
      guest_accepted_at: new Date().toISOString(),
      ...extra,
    } as any)
    .select()
    .single();
  expect(error, error?.message).toBeNull();
  return data as any;
}

async function confirm(sb: SupabaseClient, offer: any, resourceId: string) {
  const res = await writeOfferMainReservation(sb as any, offer, {
    mainType: "venue",
    resourceId,
    price: null,
    linkedGroupId: crypto.randomUUID(),
  });
  const { error } = await sb
    .from("offers")
    .update({ status: "confirmed", reservation_ids: [res.id] } as any)
    .eq("id", offer.id);
  expect(error, error?.message).toBeNull();
  return res;
}

test.describe("Confirming a guest-accepted offer: exactly one reservation", () => {
  test.skip(
    !STAFF_EMAIL || !STAFF_PASSWORD,
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD to run this spec.",
  );

  test("creates exactly one reservation when the offer has no originating booking", async ({
    tenant,
  }) => {
    const sb = await staffClient();
    const guest = makeTestGuest("AcceptNew");
    const offer = await acceptedOffer(sb, tenant.id, guest);
    try {
      expect(
        await reservationsFor(sb, tenant.id, guest.guest_email),
      ).toHaveLength(0);
      const res = await confirm(sb, offer, tenant.resources.venue);

      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(res.id);
      expect(rows[0].status).toBe("confirmed");
      expect(rows[0].date).toBe(offer.event_date);
      expect(rows[0].guests_count).toBe(20);
    } finally {
      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      if (rows.length)
        await sb
          .from("reservations")
          .delete()
          .in(
            "id",
            rows.map((r) => r.id),
          );
      await sb.from("offers").delete().eq("id", offer.id);
    }
  });

  test("updates the originating booking in place instead of adding a second one", async ({
    tenant,
  }) => {
    const sb = await staffClient();
    const guest = makeTestGuest("AcceptSource");
    const { data: source, error: srcErr } = await sb
      .from("reservations")
      .insert({
        tenant_id: tenant.id,
        reservation_type: "venue",
        status: "pending",
        date: futureDate(60),
        start_time: "18:00:00",
        end_time: "20:00:00",
        guests_count: 8,
        resource_id: tenant.resources.venue,
        language: "en",
        ...guest,
      } as any)
      .select("id")
      .single();
    expect(srcErr, srcErr?.message).toBeNull();
    const offer = await acceptedOffer(sb, tenant.id, guest, {
      source_reservation_id: source!.id,
    });
    try {
      const res = await confirm(sb, offer, tenant.resources.venue);
      expect(res.id).toBe(source!.id);

      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(source!.id);
      expect(rows[0].status).toBe("confirmed");
      expect(rows[0].guests_count).toBe(20);
      expect(rows[0].staff_notes).toBe("Public booking, confirmed via offer");
    } finally {
      await sb.from("offers").delete().eq("id", offer.id);
      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      if (rows.length)
        await sb
          .from("reservations")
          .delete()
          .in(
            "id",
            rows.map((r) => r.id),
          );
    }
  });
});
