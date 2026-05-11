import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
} from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";

/**
 * End-to-end: staff confirms an offer; verify main reservation +
 * all enabled linked (cross) reservations are created and linked back.
 *
 * Mirrors the exact business logic in
 * `src/components/dashboard/OffersManager.tsx#handleConfirm`.
 *
 * Tenant identity (slug + id) and resource ids come from the shared
 * `test-tenant` fixture so this spec stays aligned with the cross-booking
 * spec under the same tenant_id and satisfies RLS.
 *
 * Requires real owner/admin credentials for the shared test tenant,
 * provided via env vars. The spec is skipped when they are missing so
 * CI never blocks on missing secrets:
 *
 *   E2E_STAFF_EMAIL=...        # owner/admin of the shared test tenant
 *   E2E_STAFF_PASSWORD=...
 */

const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;


test.describe("Offer confirm creates main + linked cross reservations", () => {
  test.skip(
    !STAFF_EMAIL || !STAFF_PASSWORD,
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD to run this spec.",
  );

  test("confirms offer and produces main + 2 linked reservations", async ({ tenant }) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Sign in as staff
    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
      email: STAFF_EMAIL!,
      password: STAFF_PASSWORD!,
    });
    expect(signInErr, `sign-in failed: ${signInErr?.message}`).toBeNull();
    expect(signIn?.user?.id).toBeTruthy();

    // Resolve tenant id for the signed-in user and assert it matches the
    // shared fixture so guest, offer, and linked reservations all stay
    // aligned under the same tenant_id (RLS-safe).
    const { data: tenantRow, error: tenantErr } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", tenant.slug)
      .maybeSingle();
    expect(tenantErr, tenantErr?.message).toBeNull();
    expect(tenantRow?.id, `tenant '${tenant.slug}' not visible to this user`).toBeTruthy();
    expect(
      tenantRow!.id,
      `signed-in user resolves a different tenant than the shared fixture (${tenant.id})`,
    ).toBe(tenant.id);
    const tenantId = tenantRow!.id as string;

    const eventDate = futureDate(75);
    const guestName = `TEST Lovable Offer ${Date.now()}`;
    const guestEmail = `test-offer-${Date.now()}@example.com`;

    // Linked reservations: one restaurant + one guesthouse cross-booking
    const linkedReservations = {
      restaurant: {
        enabled: true,
        resource_type: "restaurant",
        start_time: "20:00",
        end_time: "22:00",
        guests_count: 30,
        space: "Main dining room",
        special_requests: "Wedding dinner",
      },
      guesthouse: {
        enabled: true,
        resource_type: "guesthouse",
        start_time: "15:00",
        guests_count: 2,
        space: "Single Room 1",
        special_requests: "Late check-in",
      },
      // Disabled link should NOT generate a reservation
      hotel: {
        enabled: false,
        resource_type: "hotel",
        guests_count: 2,
      },
    };

    // 2. Create the offer (mirrors UI form)
    const { data: offer, error: offerErr } = await supabase
      .from("offers")
      .insert({
        tenant_id: tenantId,
        status: "draft",
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: "+358 40 0000000",
        event_date: eventDate,
        start_time: "18:00",
        end_time: "23:00",
        guests_count: 30,
        event_space: "Eventos Mimmilitos",
        event_type: "Wedding",
        special_requests: "TEST: offer e2e",
        language: "en",
        linked_reservations: linkedReservations as any,
      } as any)
      .select()
      .single();
    expect(offerErr, `create offer failed: ${offerErr?.message}`).toBeNull();
    expect(offer?.id).toBeTruthy();
    const offerId = offer!.id as string;

    const cleanup = async () => {
      const { data: refreshed } = await supabase
        .from("offers")
        .select("reservation_ids")
        .eq("id", offerId)
        .maybeSingle();
      const ids = (refreshed?.reservation_ids ?? []) as string[];
      if (ids.length > 0) {
        await supabase.from("reservations").delete().in("id", ids);
      }
      await supabase.from("offers").delete().eq("id", offerId);
    };

    try {
      // 3. Replicate handleConfirm: create main reservation
      const { data: mainRes, error: mainErr } = await supabase
        .from("reservations")
        .insert({
          tenant_id: offer!.tenant_id,
          reservation_type: "venue",
          status: "confirmed",
          date: offer!.event_date,
          start_time: offer!.start_time ? `${offer!.start_time}:00` : null,
          end_time: offer!.end_time ? `${offer!.end_time}:00` : null,
          guest_name: offer!.guest_name,
          guest_email: offer!.guest_email,
          guest_phone: offer!.guest_phone,
          guests_count: offer!.guests_count,
          event_type: offer!.event_type,
          room_type: offer!.event_space,
          special_requests: offer!.special_requests,
          staff_notes: "Offer to Reservation",
          language: offer!.language || "en",
        } as any)
        .select()
        .single();
      expect(mainErr, `main reservation insert failed: ${mainErr?.message}`).toBeNull();
      const resIds: string[] = [mainRes!.id];

      // 4. Create linked reservations (only enabled ones)
      const linked = (offer!.linked_reservations || {}) as Record<string, any>;
      for (const [key, lr] of Object.entries(linked)) {
        if (!lr?.enabled) continue;
        const resType = lr.resource_type || key;
        const { data: linkedRes, error: linkedErr } = await supabase
          .from("reservations")
          .insert({
            tenant_id: offer!.tenant_id,
            reservation_type: resType,
            status: "confirmed",
            date: offer!.event_date,
            start_time: lr.start_time
              ? `${lr.start_time}:00`
              : offer!.start_time
              ? `${offer!.start_time}:00`
              : null,
            end_time: lr.end_time ? `${lr.end_time}:00` : null,
            guest_name: offer!.guest_name,
            guest_email: offer!.guest_email,
            guest_phone: offer!.guest_phone,
            guests_count: lr.guests_count || offer!.guests_count,
            event_type: offer!.event_type,
            room_type: lr.space || null,
            special_requests: lr.special_requests
              ? `Cross-reservation via offer\n${lr.special_requests}`
              : "Cross-reservation via offer",
            staff_notes: "Cross-reservation offer",
            language: offer!.language || "en",
          } as any)
          .select()
          .single();
        expect(linkedErr, `linked (${key}) insert failed: ${linkedErr?.message}`).toBeNull();
        resIds.push(linkedRes!.id);
      }

      // 5. Mark offer confirmed and link reservation ids
      const { error: updErr } = await supabase
        .from("offers")
        .update({ status: "confirmed", reservation_ids: resIds } as any)
        .eq("id", offerId);
      expect(updErr, `offer update failed: ${updErr?.message}`).toBeNull();

      // 6. Verify outcomes
      // 1 main + 2 enabled linked = 3 reservations; the disabled hotel link is excluded.
      expect(resIds, "should produce main + 2 linked reservations").toHaveLength(3);

      const { data: createdReservations, error: fetchErr } = await supabase
        .from("reservations")
        .select("id, reservation_type, status, guest_name, guest_email, date")
        .in("id", resIds);
      expect(fetchErr, fetchErr?.message).toBeNull();
      expect(createdReservations).toHaveLength(3);

      // Same guest details on every reservation
      for (const r of createdReservations || []) {
        expect(r.guest_name).toBe(guestName);
        expect(r.guest_email).toBe(guestEmail);
        expect(r.status).toBe("confirmed");
        expect(r.date).toBe(eventDate);
      }

      // Reservation types: exactly venue + restaurant + guesthouse
      const types = (createdReservations || []).map((r) => r.reservation_type).sort();
      expect(types).toEqual(["guesthouse", "restaurant", "venue"]);

      // Offer state reflects the link
      const { data: confirmedOffer } = await supabase
        .from("offers")
        .select("status, reservation_ids")
        .eq("id", offerId)
        .single();
      expect(confirmedOffer?.status).toBe("confirmed");
      expect(((confirmedOffer?.reservation_ids ?? []) as string[]).sort()).toEqual([...resIds].sort());
    } finally {
      await cleanup();
      await supabase.auth.signOut();
    }
  });
});
