import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
  makeTestGuest,
} from "./fixtures/test-tenant";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { writeOfferMainReservation } from "../src/lib/offer-confirm";
import {
  newOfferAcceptToken,
  hashOfferAcceptToken,
} from "../src/lib/offer-accept-link";
import {
  ensureOfferStaffAccounts,
  type OfferStaffAccount,
} from "./fixtures/offer-staff-accounts";

/**
 * Two DIFFERENT staff logins (no two-factor sign-in) confirm the same
 * guest-accepted offer at the same moment. Exactly one reservation may exist
 * afterwards, exactly one confirm may "win", and the offer must point at it.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY to set up the two test logins.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe("Two staff members confirm the same offer: one reservation", () => {
  test.skip(
    !SERVICE_KEY || !SUPABASE_ANON_KEY,
    "Set SUPABASE_SERVICE_ROLE_KEY and the publishable key to run this spec.",
  );
  test.describe.configure({ mode: "serial" });

  let staff: [OfferStaffAccount, OfferStaffAccount];

  test.beforeAll(async ({ tenant }) => {
    staff = await ensureOfferStaffAccounts({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      serviceKey: SERVICE_KEY!,
      tenantId: tenant.id,
    });
  });

  const reservationsFor = async (
    sb: SupabaseClient,
    tenantId: string,
    email: string,
  ) => {
    const { data, error } = await sb
      .from("reservations")
      .select("id,status,guests_count")
      .eq("tenant_id", tenantId)
      .eq("guest_email", email);
    expect(error, error?.message).toBeNull();
    return data ?? [];
  };

  const sentOffer = async (
    sb: SupabaseClient,
    tenantId: string,
    guest: ReturnType<typeof makeTestGuest>,
    extra: Record<string, unknown> = {},
  ) => {
    const token = newOfferAcceptToken();
    const { data, error } = await sb
      .from("offers")
      .insert({
        tenant_id: tenantId,
        status: "sent",
        ...guest,
        event_date: futureDate(57),
        start_time: "18:00",
        end_time: "22:00",
        guests_count: 14,
        event_space: "TEST space",
        language: "en",
        expires_on: futureDate(10),
        accept_token_hash: await hashOfferAcceptToken(token),
        ...extra,
      } as any)
      .select()
      .single();
    expect(error, error?.message).toBeNull();
    return { offer: data as any, token };
  };

  const acceptAsGuest = async (page: Page, token: string) => {
    await page.goto(`/offer/${token}`);
    await page
      .getByRole("button", { name: "Accept offer", exact: true })
      .click();
    await expect(page.getByText(/you have accepted this offer/i)).toBeVisible({
      timeout: 20_000,
    });
  };

  /** What the Offers page Confirm button does, as one staff member. */
  const confirmAs = async (
    sb: SupabaseClient,
    offerId: string,
    venue: string,
  ) => {
    const { data: offer, error } = await sb
      .from("offers")
      .select("*")
      .eq("id", offerId)
      .single();
    expect(error, error?.message).toBeNull();
    const res = await writeOfferMainReservation(sb as any, offer as any, {
      mainType: "venue",
      resourceId: venue,
      price: null,
      linkedGroupId: crypto.randomUUID(),
    });
    const { error: upErr } = await sb
      .from("offers")
      .update({ status: "confirmed", reservation_ids: [res.id] } as any)
      .eq("id", offerId);
    expect(upErr, upErr?.message).toBeNull();
    return res;
  };

  const cleanup = async (
    sb: SupabaseClient,
    tenantId: string,
    offerId: string | undefined,
    email: string,
  ) => {
    if (offerId) await sb.from("offers").delete().eq("id", offerId);
    const rows = await reservationsFor(sb, tenantId, email);
    if (rows.length)
      await sb
        .from("reservations")
        .delete()
        .in(
          "id",
          rows.map((r) => r.id),
        );
  };

  test("the two test logins are different people in the test business, without two-factor sign-in", async ({
    tenant,
  }) => {
    expect(staff[0].userId).not.toBe(staff[1].userId);
    for (const s of staff) {
      const { data: user } = await s.client.auth.getUser();
      expect(user.user?.id).toBe(s.userId);
      const { data: factors, error } = await s.client.auth.mfa.listFactors();
      expect(error, error?.message).toBeNull();
      expect(factors?.all ?? []).toHaveLength(0);
      const { data: aal } =
        await s.client.auth.mfa.getAuthenticatorAssuranceLevel();
      expect(aal?.currentLevel).toBe("aal1");
      expect(aal?.nextLevel).toBe("aal1");
      const { data: rows, error: memErr } = await s.client
        .from("tenant_users")
        .select("tenant_id,role,is_approved")
        .eq("user_id", s.userId);
      expect(memErr, memErr?.message).toBeNull();
      expect(rows).toEqual([
        { tenant_id: tenant.id, role: "admin", is_approved: true },
      ]);
    }
  });

  for (const round of [1, 2, 3]) {
    test(`two staff confirm a new offer at once: one reservation (round ${round})`, async ({
      page,
      tenant,
    }) => {
      const [a, b] = staff;
      const guest = makeTestGuest(`TwoStaffNew${round}`);
      let offerId: string | undefined;
      try {
        const { offer, token } = await sentOffer(a.client, tenant.id, guest);
        offerId = offer.id;
        await acceptAsGuest(page, token);

        const [ra, rb] = await Promise.all([
          confirmAs(a.client, offer.id, tenant.resources.venue),
          confirmAs(b.client, offer.id, tenant.resources.venue),
        ]);
        expect(rb.id).toBe(ra.id);
        expect([ra, rb].filter((r) => !r.alreadyConfirmed)).toHaveLength(1);

        // Both staff members see the same single reservation.
        for (const s of staff) {
          const rows = await reservationsFor(
            s.client,
            tenant.id,
            guest.guest_email,
          );
          expect(rows).toHaveLength(1);
          expect(rows[0].id).toBe(ra.id);
          expect(rows[0].status).toBe("confirmed");
          expect(rows[0].guests_count).toBe(14);
        }
        const { data: saved } = await b.client
          .from("offers")
          .select("status,reservation_ids")
          .eq("id", offer.id)
          .single();
        expect(saved?.status).toBe("confirmed");
        expect(saved?.reservation_ids).toEqual([ra.id]);
      } finally {
        await cleanup(a.client, tenant.id, offerId, guest.guest_email);
      }
    });
  }

  test("two staff confirm an offer made from a booking at once: that booking is reused", async ({
    page,
    tenant,
  }) => {
    const [a, b] = staff;
    const guest = makeTestGuest("TwoStaffSource");
    let offerId: string | undefined;
    try {
      const { data: source, error: srcErr } = await a.client
        .from("reservations")
        .insert({
          tenant_id: tenant.id,
          reservation_type: "venue",
          status: "pending",
          date: futureDate(57),
          start_time: "18:00:00",
          end_time: "20:00:00",
          guests_count: 6,
          resource_id: tenant.resources.venue,
          language: "en",
          ...guest,
        } as any)
        .select("id")
        .single();
      expect(srcErr, srcErr?.message).toBeNull();
      const { offer, token } = await sentOffer(a.client, tenant.id, guest, {
        source_reservation_id: source!.id,
      });
      offerId = offer.id;
      await acceptAsGuest(page, token);

      const [ra, rb] = await Promise.all([
        confirmAs(a.client, offer.id, tenant.resources.venue),
        confirmAs(b.client, offer.id, tenant.resources.venue),
      ]);
      expect(ra.id).toBe(source!.id);
      expect(rb.id).toBe(source!.id);
      expect([ra, rb].filter((r) => !r.alreadyConfirmed)).toHaveLength(1);

      const rows = await reservationsFor(b.client, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(source!.id);
      expect(rows[0].status).toBe("confirmed");
      expect(rows[0].guests_count).toBe(14);
    } finally {
      await cleanup(a.client, tenant.id, offerId, guest.guest_email);
    }
  });
});
