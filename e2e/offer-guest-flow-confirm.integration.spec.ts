import {
  test,
  expect,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  futureDate,
  makeTestGuest,
} from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { writeOfferMainReservation } from "../src/lib/offer-confirm";
import {
  newOfferAcceptToken,
  hashOfferAcceptToken,
} from "../src/lib/offer-accept-link";

/**
 * Integration: the guest accepts an offer through the real guest page
 * (/offer/<token>, signed out, "Accept offer" button), then staff confirm it.
 * The guest must end up with EXACTLY ONE reservation:
 *
 *  A. Offer with no originating booking: one new reservation is created.
 *  B. Offer made from an existing booking: that booking is updated in place.
 *
 * Staff steps run against the test database with a signed-in staff client
 * (RLS applies) and use the same writer as the Offers page Confirm button.
 *
 * Needs staff access to the shared test business, one of:
 *   E2E_STAFF_EMAIL + E2E_STAFF_PASSWORD, or E2E_STAFF_SESSION_JSON
 */
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;
const STAFF_SESSION = process.env.E2E_STAFF_SESSION_JSON;

async function staffClient(): Promise<SupabaseClient> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = STAFF_SESSION
    ? await sb.auth.setSession(JSON.parse(STAFF_SESSION))
    : await sb.auth.signInWithPassword({
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
    .select("id,status,guests_count,staff_notes")
    .eq("tenant_id", tenantId)
    .eq("guest_email", email);
  expect(error, error?.message).toBeNull();
  return data ?? [];
}

/** Create a sent offer with a live accept link; returns the offer and token. */
async function sentOffer(
  sb: SupabaseClient,
  tenantId: string,
  guest: ReturnType<typeof makeTestGuest>,
  extra: Record<string, unknown> = {},
) {
  const token = newOfferAcceptToken();
  const { data, error } = await sb
    .from("offers")
    .insert({
      tenant_id: tenantId,
      status: "sent",
      ...guest,
      event_date: futureDate(55),
      start_time: "18:00",
      end_time: "22:00",
      guests_count: 16,
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
}

/** Guest-facing step: open the link signed out and press Accept offer. */
async function acceptAsGuest(page: Page, token: string) {
  await page.goto(`/offer/${token}`);
  await page.getByRole("button", { name: "Accept offer", exact: true }).click();
  await expect(page.getByText(/you have accepted this offer/i)).toBeVisible({
    timeout: 20_000,
  });
}

async function staffConfirm(
  sb: SupabaseClient,
  offerId: string,
  venue: string,
) {
  const { data: offer, error } = await sb
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .single();
  expect(error, error?.message).toBeNull();
  expect(offer!.guest_accepted_at, "guest acceptance recorded").toBeTruthy();
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
}

async function cleanup(
  sb: SupabaseClient,
  tenantId: string,
  offerId: string | undefined,
  email: string,
) {
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
}

test.describe("Guest accepts offer online, staff confirm: exactly one reservation", () => {
  test.skip(
    !STAFF_SESSION && (!STAFF_EMAIL || !STAFF_PASSWORD),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD (or E2E_STAFF_SESSION_JSON) to run this spec.",
  );

  test("creates one reservation for an offer with no originating booking", async ({
    page,
    tenant,
  }) => {
    const sb = await staffClient();
    const guest = makeTestGuest("GuestFlowNew");
    let offerId: string | undefined;
    try {
      const { offer, token } = await sentOffer(sb, tenant.id, guest);
      offerId = offer.id;
      await acceptAsGuest(page, token);
      const res = await staffConfirm(sb, offer.id, tenant.resources.venue);

      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(res.id);
      expect(rows[0].status).toBe("confirmed");
      expect(rows[0].guests_count).toBe(16);
    } finally {
      await cleanup(sb, tenant.id, offerId, guest.guest_email);
    }
  });

  test("confirming the same accepted offer twice leaves exactly one reservation", async ({
    page,
    tenant,
  }) => {
    const sb = await staffClient();
    const guest = makeTestGuest("GuestFlowTwice");
    let offerId: string | undefined;
    try {
      const { offer, token } = await sentOffer(sb, tenant.id, guest);
      offerId = offer.id;
      await acceptAsGuest(page, token);
      const first = await staffConfirm(sb, offer.id, tenant.resources.venue);
      const second = await staffConfirm(sb, offer.id, tenant.resources.venue);
      expect(second.id).toBe(first.id);

      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(first.id);
      expect(rows[0].status).toBe("confirmed");
    } finally {
      await cleanup(sb, tenant.id, offerId, guest.guest_email);
    }
  });

  test("confirming three times in a row keeps exactly one reservation", async ({
    page,
    tenant,
  }) => {
    const sb = await staffClient();
    const guest = makeTestGuest("GuestFlowThrice");
    let offerId: string | undefined;
    try {
      const { offer, token } = await sentOffer(sb, tenant.id, guest);
      offerId = offer.id;
      await acceptAsGuest(page, token);
      const ids: string[] = [];
      for (let i = 0; i < 3; i++)
        ids.push((await staffConfirm(sb, offer.id, tenant.resources.venue)).id);
      expect(new Set(ids).size).toBe(1);
      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(ids[0]);
    } finally {
      await cleanup(sb, tenant.id, offerId, guest.guest_email);
    }
  });

  test("simultaneous confirms from a stale list create only one reservation", async ({
    page,
    tenant,
  }) => {
    const sb = await staffClient();
    const sb2 = await staffClient();
    const guest = makeTestGuest("GuestFlowRace");
    let offerId: string | undefined;
    try {
      const { offer, token } = await sentOffer(sb, tenant.id, guest);
      offerId = offer.id;
      await acceptAsGuest(page, token);
      // Two tabs hold the same not-yet-confirmed offer and press Confirm at once.
      const { data: stale } = await sb
        .from("offers")
        .select("*")
        .eq("id", offer.id)
        .single();
      const confirmOnce = (c: SupabaseClient) =>
        writeOfferMainReservation(c as any, stale as any, {
          mainType: "venue",
          resourceId: tenant.resources.venue,
          price: null,
          linkedGroupId: crypto.randomUUID(),
        });
      const results = await Promise.all([
        confirmOnce(sb),
        confirmOnce(sb2),
        confirmOnce(sb),
        confirmOnce(sb2),
      ]);
      expect(new Set(results.map((r) => r.id)).size).toBe(1);
      expect(results.filter((r) => !r.alreadyConfirmed)).toHaveLength(1);

      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("confirmed");

      // A late Confirm after the offer is saved as confirmed still reuses it.
      const late = await staffConfirm(sb, offer.id, tenant.resources.venue);
      expect(late.id).toBe(rows[0].id);
      expect(
        await reservationsFor(sb, tenant.id, guest.guest_email),
      ).toHaveLength(1);
    } finally {
      await cleanup(sb, tenant.id, offerId, guest.guest_email);
    }
  });

  test("repeated confirms of an offer made from a booking never add a second one", async ({
    page,
    tenant,
  }) => {
    const sb = await staffClient();
    const guest = makeTestGuest("GuestFlowSourceRepeat");
    let offerId: string | undefined;
    try {
      const { data: source, error: srcErr } = await sb
        .from("reservations")
        .insert({
          tenant_id: tenant.id,
          reservation_type: "venue",
          status: "pending",
          date: futureDate(55),
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
      const { offer, token } = await sentOffer(sb, tenant.id, guest, {
        source_reservation_id: source!.id,
      });
      offerId = offer.id;
      await acceptAsGuest(page, token);
      const { data: stale } = await sb
        .from("offers")
        .select("*")
        .eq("id", offer.id)
        .single();
      const results = await Promise.all(
        [0, 1, 2].map(() =>
          writeOfferMainReservation(sb as any, stale as any, {
            mainType: "venue",
            resourceId: tenant.resources.venue,
            price: null,
            linkedGroupId: crypto.randomUUID(),
          }),
        ),
      );
      expect(results.every((r) => r.id === source!.id)).toBe(true);
      const again = await staffConfirm(sb, offer.id, tenant.resources.venue);
      expect(again.id).toBe(source!.id);
      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(source!.id);
    } finally {
      await cleanup(sb, tenant.id, offerId, guest.guest_email);
    }
  });

  test("updates the originating booking instead of adding a second one", async ({
    page,
    tenant,
  }) => {
    const sb = await staffClient();
    const guest = makeTestGuest("GuestFlowSource");
    let offerId: string | undefined;
    try {
      const { data: source, error: srcErr } = await sb
        .from("reservations")
        .insert({
          tenant_id: tenant.id,
          reservation_type: "venue",
          status: "pending",
          date: futureDate(55),
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

      const { offer, token } = await sentOffer(sb, tenant.id, guest, {
        source_reservation_id: source!.id,
      });
      offerId = offer.id;
      await acceptAsGuest(page, token);
      const res = await staffConfirm(sb, offer.id, tenant.resources.venue);
      expect(res.id).toBe(source!.id);

      const rows = await reservationsFor(sb, tenant.id, guest.guest_email);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(source!.id);
      expect(rows[0].status).toBe("confirmed");
      expect(rows[0].guests_count).toBe(16);
      expect(rows[0].staff_notes).toBe("Public booking, confirmed via offer");
    } finally {
      await cleanup(sb, tenant.id, offerId, guest.guest_email);
    }
  });
});
