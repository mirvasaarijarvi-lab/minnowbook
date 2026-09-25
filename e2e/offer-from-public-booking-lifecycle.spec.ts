import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
  makeTestGuest,
} from "./fixtures/test-tenant";
import { callPublicBooking, isPlatformDegraded } from "./fixtures/public-booking-client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { offerPrefillFromReservation } from "../src/lib/offer-from-reservation";
import { offerTrackStatus } from "../src/lib/offer-status";

/**
 * End-to-end lifecycle: guest booking -> offer -> guest acceptance ->
 * full reservation.
 *
 *  1. A guest books through the real `public-booking` function.
 *  2. Staff press "Make an offer": the form is prefilled from that booking
 *     using the same mapper the dialog uses (offerPrefillFromReservation),
 *     and the offer keeps a link to the booking (source_reservation_id).
 *  3. The offer is sent (pending) with an expiry date.
 *  4. The guest accepts (by replying) and staff press Confirm. As in
 *     OffersManager#executeConfirm, the ORIGINAL booking is updated into the
 *     confirmed reservation. No second booking is created.
 *  5. Traceability: the offer points at the booking and the booking lists
 *     the offer, with the guest details intact.
 *
 * A second test covers the decline and expiry paths, which must leave the
 * guest booking untouched.
 *
 * Requires staff credentials for the shared test tenant; skipped otherwise:
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
  expect(error, `staff sign-in failed: ${error?.message}`).toBeNull();
  return sb;
}

async function guestBooks(
  request: any,
  tenant: any,
  label: string,
  offsetDays: number,
) {
  const guest = makeTestGuest(label);
  const date = futureDate(offsetDays);
  const result = await callPublicBooking({
    request,
    label,
    body: {
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      resource_id: tenant.resources.venue,
      reservation_type: "venue",
      date,
      start_time: "17:00",
      end_time: "22:00",
      guests_count: 24,
      event_type: "Birthday",
      special_requests: "TEST: offer lifecycle, vegetarian menu please",
      language: "en",
      ...guest,
    },
  });
  test.skip(
    isPlatformDegraded(result.status, result.body),
    "public-booking is degraded in this environment",
  );
  expect(
    result.status,
    `public booking failed: ${JSON.stringify(result.diagnostic)}`,
  ).toBeLessThan(400);
  const id = result.body?.reservation?.id as string;
  expect(id, "public booking must return a reservation id").toBeTruthy();
  return { id, guest, date };
}

test.describe("Offer from a public booking: full lifecycle", () => {
  test.skip(
    !STAFF_EMAIL || !STAFF_PASSWORD,
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD to run this spec.",
  );

  test("guest booking data flows into the offer, acceptance converts the same booking", async ({
    request,
    tenant,
  }) => {
    const booking = await guestBooks(request, tenant, "OfferLife", 80);
    const sb = await staffClient();
    let offerId: string | null = null;
    try {
      // --- 1) Public booking is saved as a guest booking -----------------
      const { data: original, error: resErr } = await sb
        .from("reservations")
        .select("*, resources(name)")
        .eq("id", booking.id)
        .eq("tenant_id", tenant.id)
        .single();
      expect(resErr, resErr?.message).toBeNull();
      expect(original.created_by, "guest bookings have no staff creator").toBeNull();
      expect(original.guest_name).toBe(booking.guest.guest_name);
      expect(original.guest_email).toBe(booking.guest.guest_email);
      expect(original.date).toBe(booking.date);
      expect(original.status).not.toBe("confirmed");

      // --- 2) Make an offer: prefill carries the booking data -----------
      const prefill = offerPrefillFromReservation(original);
      expect(prefill).toMatchObject({
        guest_name: booking.guest.guest_name,
        guest_email: booking.guest.guest_email,
        guest_phone: booking.guest.guest_phone,
        event_date: booking.date,
        start_time: "17:00",
        guests_count: 24,
        event_type: "Birthday",
        language: "en",
        source_reservation_id: booking.id,
      });
      expect(prefill.special_requests).toContain("vegetarian");

      // Staff fill in the rest.
      const expiresOn = futureDate(14);
      const { data: offer, error: offerErr } = await sb
        .from("offers")
        .insert({
          ...prefill,
          tenant_id: tenant.id,
          status: "draft",
          event_space: prefill.event_space || "Main hall",
          menu: "TEST menu: three courses",
          invoicing_details: "TEST invoicing",
          expires_on: expiresOn,
        } as any)
        .select()
        .single();
      expect(offerErr, offerErr?.message).toBeNull();
      offerId = offer.id;
      expect(offerTrackStatus(offer)).toBe("draft");

      // --- 3) Send: offer becomes pending --------------------------------
      const { data: sent, error: sentErr } = await sb
        .from("offers")
        .update({ status: "sent", last_sent_at: new Date().toISOString() } as any)
        .eq("id", offerId!)
        .select()
        .single();
      expect(sentErr, sentErr?.message).toBeNull();
      expect(offerTrackStatus(sent)).toBe("pending");

      // --- 4) Guest accepts, staff press Confirm -------------------------
      // Mirrors OffersManager#executeConfirm for offers with a source booking.
      const agreedPrice = 1450;
      const { data: converted, error: convErr } = await sb
        .from("reservations")
        .update({
          status: "confirmed",
          date: sent.event_date,
          start_time: `${sent.start_time}:00`,
          end_time: sent.end_time ? `${sent.end_time}:00` : null,
          guests_count: sent.guests_count,
          room_type: sent.event_space,
          price_eur: agreedPrice,
          staff_notes: "Public booking, confirmed via offer",
        } as any)
        .eq("id", booking.id)
        .eq("tenant_id", tenant.id)
        .select()
        .single();
      expect(convErr, convErr?.message).toBeNull();
      expect(converted.id).toBe(booking.id);

      const { data: accepted, error: accErr } = await sb
        .from("offers")
        .update({
          status: "confirmed",
          accepted_at: new Date().toISOString(),
          reservation_ids: [booking.id],
        } as any)
        .eq("id", offerId!)
        .select()
        .single();
      expect(accErr, accErr?.message).toBeNull();
      expect(offerTrackStatus(accepted)).toBe("accepted");

      // --- 5) Verify: one full reservation, guest details intact ---------
      const { data: final } = await sb
        .from("reservations")
        .select("id, status, price_eur, guest_name, guest_email, guest_phone, created_by")
        .eq("id", booking.id)
        .single();
      expect(final).toMatchObject({
        status: "confirmed",
        guest_name: booking.guest.guest_name,
        guest_email: booking.guest.guest_email,
        created_by: null,
      });
      expect(Number(final!.price_eur)).toBe(agreedPrice);

      const { count } = await sb
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("guest_email", booking.guest.guest_email)
        .eq("date", booking.date);
      expect(count, "acceptance must not create a duplicate booking").toBe(1);

      // Traceability both ways.
      const { data: fromBooking } = await sb
        .from("offers")
        .select("id, status")
        .eq("tenant_id", tenant.id)
        .eq("source_reservation_id", booking.id);
      expect(fromBooking?.map((o) => o.id)).toEqual([offerId]);
      expect(accepted.source_reservation_id).toBe(booking.id);
    } finally {
      if (offerId) await sb.from("offers").delete().eq("id", offerId);
      await sb.from("reservations").delete().eq("id", booking.id);
      await sb.auth.signOut();
    }
  });

  test("declined and expired offers leave the guest booking untouched", async ({
    request,
    tenant,
  }) => {
    const booking = await guestBooks(request, tenant, "OfferDecline", 82);
    const sb = await staffClient();
    const ids: string[] = [];
    try {
      const { data: original } = await sb
        .from("reservations")
        .select("*")
        .eq("id", booking.id)
        .single();
      const prefill = offerPrefillFromReservation(original);
      const base = {
        ...prefill,
        tenant_id: tenant.id,
        event_space: prefill.event_space || "Main hall",
        last_sent_at: new Date().toISOString(),
      };

      const { data: declined, error: dErr } = await sb
        .from("offers")
        .insert({
          ...base,
          status: "declined",
          declined_at: new Date().toISOString(),
        } as any)
        .select()
        .single();
      expect(dErr, dErr?.message).toBeNull();
      ids.push(declined.id);
      expect(offerTrackStatus(declined)).toBe("declined");

      // Sent offer whose last valid day was yesterday reads as expired.
      const { data: expired, error: eErr } = await sb
        .from("offers")
        .insert({ ...base, status: "sent", expires_on: futureDate(-1) } as any)
        .select()
        .single();
      expect(eErr, eErr?.message).toBeNull();
      ids.push(expired.id);
      expect(offerTrackStatus(expired)).toBe("expired");

      const { data: after } = await sb
        .from("reservations")
        .select("status, price_eur, staff_notes, updated_at")
        .eq("id", booking.id)
        .single();
      expect(after).toMatchObject({
        status: original.status,
        staff_notes: original.staff_notes,
        updated_at: original.updated_at,
      });
    } finally {
      if (ids.length) await sb.from("offers").delete().in("id", ids);
      await sb.from("reservations").delete().eq("id", booking.id);
      await sb.auth.signOut();
    }
  });
});
