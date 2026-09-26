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
import {
  newOfferAcceptToken,
  hashOfferAcceptToken,
} from "../src/lib/offer-accept-link";

/**
 * Integration: once staff withdraw an offer (Mark declined or archive) or it
 * expires, the guest can no longer accept it, neither on the guest page nor
 * by calling the accept function directly. The offer must stay unaccepted
 * and no reservation may appear.
 *
 * Needs staff access to the shared test business, one of:
 *   E2E_STAFF_EMAIL + E2E_STAFF_PASSWORD, or E2E_STAFF_SESSION_JSON
 */
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;
const STAFF_SESSION = process.env.E2E_STAFF_SESSION_JSON;

const CLOSED = /can no longer be accepted online/i;
const EXPIRED = /this offer has expired/i;
const NOT_FOUND = /this link is not valid/i;

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

const guestClient = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function sentOffer(
  sb: SupabaseClient,
  tenantId: string,
  guest: ReturnType<typeof makeTestGuest>,
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
      guests_count: 12,
      event_space: "TEST space",
      language: "en",
      expires_on: futureDate(10),
      accept_token_hash: await hashOfferAcceptToken(token),
    } as any)
    .select("id")
    .single();
  expect(error, error?.message).toBeNull();
  return { id: data!.id as string, token };
}

async function withdraw(
  sb: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await sb.from("offers").update(patch).eq("id", id);
  expect(error, error?.message).toBeNull();
}

/** The offer must still be unaccepted and the guest must have no reservation. */
async function expectNotAccepted(
  sb: SupabaseClient,
  tenantId: string,
  id: string,
  email: string,
) {
  const { data } = await sb
    .from("offers")
    .select("guest_accepted_at,status")
    .eq("id", id)
    .single();
  expect(data!.guest_accepted_at).toBeNull();
  expect(data!.status).not.toBe("confirmed");
  const { data: res } = await sb
    .from("reservations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("guest_email", email);
  expect(res ?? []).toHaveLength(0);
}

async function directAccept(token: string) {
  const { data, error } = await guestClient().rpc(
    "accept_offer_by_guest" as any,
    { _token: token },
  );
  expect(error, error?.message).toBeNull();
  return data as { ok: boolean; reason: string };
}

const noAcceptButton = (page: Page) =>
  expect(
    page.getByRole("button", { name: "Accept offer", exact: true }),
  ).toHaveCount(0);

const CASES: {
  name: string;
  patch: Record<string, unknown>;
  message: RegExp;
  reason: string;
}[] = [
  {
    name: "withdrawn with Mark declined",
    patch: { status: "declined" },
    message: CLOSED,
    reason: "not_open",
  },
  {
    name: "marked expired by staff",
    patch: { status: "expired" },
    message: CLOSED,
    reason: "not_open",
  },
  {
    name: "past its valid-until date",
    patch: { expires_on: futureDate(-1) },
    message: EXPIRED,
    reason: "expired",
  },
  {
    name: "archived by staff",
    patch: { archived_at: new Date().toISOString() },
    message: NOT_FOUND,
    reason: "not_found",
  },
];

test.describe("Guest cannot accept a withdrawn or expired offer", () => {
  test.skip(
    !STAFF_SESSION && (!STAFF_EMAIL || !STAFF_PASSWORD),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD (or E2E_STAFF_SESSION_JSON) to run this spec.",
  );

  for (const c of CASES) {
    test(`offer ${c.name}: guest page blocks it and direct accept is refused`, async ({
      page,
      tenant,
    }) => {
      const sb = await staffClient();
      const guest = makeTestGuest("GuestBlocked");
      let id: string | undefined;
      try {
        const o = await sentOffer(sb, tenant.id, guest);
        id = o.id;
        await withdraw(sb, id, c.patch);

        await page.goto(`/offer/${o.token}`);
        await expect(page.getByText(c.message)).toBeVisible({
          timeout: 20_000,
        });
        await noAcceptButton(page);

        const r = await directAccept(o.token);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(c.reason);
        await expectNotAccepted(sb, tenant.id, id, guest.guest_email);
      } finally {
        if (id) await sb.from("offers").delete().eq("id", id);
      }
    });
  }

  test("guest page opened before staff withdraw it: pressing Accept is refused", async ({
    page,
    tenant,
  }) => {
    const sb = await staffClient();
    const guest = makeTestGuest("GuestBlockedLate");
    let id: string | undefined;
    try {
      const o = await sentOffer(sb, tenant.id, guest);
      id = o.id;
      await page.goto(`/offer/${o.token}`);
      const accept = page.getByRole("button", {
        name: "Accept offer",
        exact: true,
      });
      await expect(accept).toBeVisible({ timeout: 20_000 });

      await withdraw(sb, id, { status: "declined" });
      await accept.click();
      await expect(page.getByText(CLOSED)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/you have accepted this offer/i)).toHaveCount(
        0,
      );
      await expectNotAccepted(sb, tenant.id, id, guest.guest_email);
    } finally {
      if (id) await sb.from("offers").delete().eq("id", id);
    }
  });
});
