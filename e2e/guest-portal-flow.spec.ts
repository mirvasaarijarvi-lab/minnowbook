/**
 * End-to-end smoke test for the guest self-service flow.
 *
 * Covered path:
 *   Find booking (magic-link request)
 *     -> guest portal opened with a booking token
 *     -> guest asks for a new date (reschedule request)
 *     -> staff approve it through `reschedule-review` (booking moves)
 *     -> a second booking is cancelled by the guest through the portal
 *
 * Everything runs against a per-test ephemeral tenant so no shared fixture
 * data is touched. The staff half signs in with a throwaway auth user, which
 * is the only way to exercise the real authorization branch of
 * `reschedule-review` instead of stubbing it.
 */
import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const HAS_SERVICE_ROLE = Boolean(
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
);

test.skip(!HAS_SERVICE_ROLE || !SUPABASE_ANON_KEY, "guest portal e2e needs backend keys");

/** `YYYY-MM-DD`, `offsetDays` from today. */
function futureDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

type SeededBooking = { reservationId: string; token: string; guestName: string; guestEmail: string };

/** Create a confirmed booking plus the portal token the guest would receive. */
async function seedBooking(
  admin: SupabaseClient,
  tenantId: string,
  label: string,
): Promise<SeededBooking> {
  const stamp = Date.now();
  const guestName = `TEST CI guest ${label} ${stamp}`;
  const guestEmail = `ci+guest-${label}-${stamp}@mimmobook.test`;

  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .insert({
      tenant_id: tenantId,
      reservation_type: "restaurant",
      status: "confirmed",
      date: futureDate(30),
      start_time: "18:00:00",
      end_time: "20:00:00",
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: "+358 40 0000000",
      guests_count: 2,
      language: "en",
    })
    .select("id")
    .single();
  if (resErr) throw new Error(`seed reservation failed: ${resErr.message}`);

  const token = `ci${randomUUID().replace(/-/g, "")}`;
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: tokErr } = await admin.from("booking_tokens").insert({
    reservation_id: reservation.id,
    tenant_id: tenantId,
    token,
    expires_at: expires,
    is_revoked: false,
  });
  if (tokErr) throw new Error(`seed token failed: ${tokErr.message}`);

  return { reservationId: reservation.id, token, guestName, guestEmail };
}

/** Throwaway staff account inside the ephemeral tenant, returns its access token. */
async function signInStaff(admin: SupabaseClient, tenantId: string): Promise<string> {
  const email = `ci+staff-${randomUUID().slice(0, 8)}@mimmobook.test`;
  const password = `Ci-Staff-${randomUUID()}-Z9!`;
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created.user) throw userErr ?? new Error("staff createUser failed");

  const { error: memberErr } = await admin.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: created.user.id,
    role: "admin",
    is_approved: true,
  });
  if (memberErr) throw new Error(`staff membership failed: ${memberErr.message}`);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok || !body?.access_token) {
    throw new Error(`staff sign-in failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.access_token as string;
}

test.describe("guest self-service flow", () => {
  test("find booking, reschedule, staff approval, and guest cancellation", async ({
    ephemeralTenant,
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const { admin, tenantId } = ephemeralTenant;
    const booking = await seedBooking(admin, tenantId, "reschedule");

    // --- 1. Find booking -----------------------------------------------------
    await page.goto("/find-booking");
    await page.getByLabel(/email/i).fill(booking.guestEmail);
    await page.getByRole("button", { name: /send|lähetä|skicka/i }).click();
    // The lookup always answers 200 (it must not reveal whether the address
    // exists), so the confirmation panel is the observable outcome.
    await expect(page.getByRole("button", { name: /another|toinen|annan/i })).toBeVisible({
      timeout: 30_000,
    });

    // --- 2. Portal opens with the seeded booking ------------------------------
    await page.goto(`/my-booking/${booking.token}`);
    await expect(page.getByText(booking.guestName)).toBeVisible({ timeout: 30_000 });

    // --- 3. Guest requests a new date ----------------------------------------
    const requestedDate = futureDate(45);
    await page.locator("#reschedule-date").fill(requestedDate);
    await page.locator("#reschedule-time").fill("17:30");
    await page.locator("#reschedule-note").fill("TEST CI please move us earlier");
    await page.getByRole("button", { name: /request|pyydä|begär/i }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("reschedule_requests")
            .select("id, status, requested_date")
            .eq("reservation_id", booking.reservationId)
            .maybeSingle();
          return data?.status ?? null;
        },
        { timeout: 30_000, message: "reschedule request was never stored as pending" },
      )
      .toBe("pending");

    const { data: pending } = await admin
      .from("reschedule_requests")
      .select("id, requested_date")
      .eq("reservation_id", booking.reservationId)
      .single();
    expect(pending!.requested_date).toBe(requestedDate);

    // --- 4. Staff review ------------------------------------------------------
    // Unauthenticated review attempts must never move a booking.
    const anon = await request.post(`${SUPABASE_URL}/functions/v1/reschedule-review`, {
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      data: { request_id: pending!.id, decision: "approved" },
      timeout: 30_000,
    });
    expect(anon.status(), "review without a session must be rejected").toBeGreaterThanOrEqual(400);

    const staffToken = await signInStaff(admin, tenantId);
    const approve = await request.post(`${SUPABASE_URL}/functions/v1/reschedule-review`, {
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${staffToken}`,
      },
      data: { request_id: pending!.id, decision: "approved", staff_note: "TEST CI approved" },
      timeout: 30_000,
    });
    expect(approve.status(), await approve.text()).toBe(200);

    const { data: moved } = await admin
      .from("reservations")
      .select("date, start_time")
      .eq("id", booking.reservationId)
      .single();
    expect(moved!.date).toBe(requestedDate);
    expect(String(moved!.start_time).slice(0, 5)).toBe("17:30");

    const { data: closed } = await admin
      .from("reschedule_requests")
      .select("status")
      .eq("id", pending!.id)
      .single();
    expect(closed!.status).toBe("approved");

    // --- 5. Cancel path -------------------------------------------------------
    const second = await seedBooking(admin, tenantId, "cancel");
    await page.goto(`/my-booking/${second.token}`);
    await expect(page.getByText(second.guestName)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /cancel booking|peruuta varaus|avboka/i }).click();
    await page.getByRole("button", { name: /yes|kyllä|ja,/i }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("reservations")
            .select("status")
            .eq("id", second.reservationId)
            .maybeSingle();
          return data?.status ?? null;
        },
        { timeout: 30_000, message: "guest cancellation never reached the booking" },
      )
      .toBe("cancelled");

    // The link must stop working once the booking is gone.
    const { data: tokenRow } = await admin
      .from("booking_tokens")
      .select("is_revoked")
      .eq("token", second.token)
      .single();
    expect(tokenRow!.is_revoked).toBe(true);

    // booking_tokens and reschedule_requests are not covered by the tenant
    // cascade, so clear them explicitly before the fixture drops the tenant.
    await admin.from("reschedule_requests").delete().eq("tenant_id", tenantId);
    await admin.from("booking_tokens").delete().eq("tenant_id", tenantId);
  });
});
