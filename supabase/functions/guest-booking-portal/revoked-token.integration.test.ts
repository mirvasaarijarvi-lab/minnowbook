// Integration test against a real backend: a revoked guest booking link is
// refused by the DEPLOYED guest-booking-portal function.
//
// Setup (as a signed-in owner/admin of a test business):
//   1. pick one existing booking in that business (read only),
//   2. store a fresh, already-revoked link for it,
//   3. call the portal as a guest (publishable key, no sign-in) with that link
//      to view, change and cancel,
//   4. check the booking itself did not change, then delete the link.
//
// Needs SUPABASE_URL + a publishable key, and an owner/admin access token in
// GUEST_PORTAL_TEST_ACCESS_TOKEN (falls back to ADMIN_USERS_TEST_ACCESS_TOKEN).
// Self-skips when any is missing or the business has no bookings.
import { createClient } from "npm:@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const STAFF_TOKEN =
  Deno.env.get("GUEST_PORTAL_TEST_ACCESS_TOKEN") ?? Deno.env.get("ADMIN_USERS_TEST_ACCESS_TOKEN");
const ENABLED = !!URL_BASE && !!KEY && !!STAFF_TOKEN;

async function guestCall(body: Record<string, unknown>) {
  const res = await fetch(`${URL_BASE}/functions/v1/guest-booking-portal`, {
    method: "POST",
    headers: { apikey: KEY!, "Content-Type": "application/json", Origin: "https://mimmobook.com" },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

Deno.test({
  name: "guest portal integration: a revoked link cannot view, change or cancel its booking",
  ignore: !ENABLED,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const staff = createClient(URL_BASE!, KEY!, {
      global: { headers: { Authorization: `Bearer ${STAFF_TOKEN}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await staff.auth.getUser(STAFF_TOKEN);
    assert(!userErr && userData.user, `staff token rejected: ${userErr?.message}`);
    const { data: membership } = await staff
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userData.user.id)
      .in("role", ["superadmin", "owner", "admin"])
      .limit(1)
      .maybeSingle();
    // A token was supplied, so a missing setup is a failure, not a silent pass.
    if (!membership) {
      throw new Error("test login is not an owner/admin of any business");
    }

    const before = await staff
      .from("reservations")
      .select("id, tenant_id, status, date, start_time, updated_at")
      .eq("tenant_id", membership.tenant_id)
      .neq("status", "cancelled")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!before.data) {
      throw new Error("the test business has no active bookings to attach a link to");
    }
    const reservation = before.data;

    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error: insErr } = await staff.from("booking_tokens").insert({
      token,
      reservation_id: reservation.id,
      tenant_id: reservation.tenant_id,
      is_revoked: true,
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
    assert(!insErr, `could not store the revoked test link: ${insErr?.message}`);

    try {
      await t.step("view is refused with code revoked and shows no booking", async () => {
        const r = await guestCall({ action: "view", token });
        assertEquals(r.status, 200, r.text);
        const body = JSON.parse(r.text);
        assertEquals(body.ok, false, r.text);
        assertEquals(body.code, "revoked", r.text);
        assert(!("reservation" in body), `revoked link leaked booking data: ${r.text}`);
      });

      await t.step("changing the date is refused", async () => {
        const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
        const r = await guestCall({ action: "reschedule", token, requested_date: date });
        assertEquals(r.status, 403, r.text);
      });

      await t.step("cancelling is refused", async () => {
        const r = await guestCall({ action: "cancel", token, language: "en" });
        assertEquals(r.status, 403, r.text);
      });

      await t.step("the booking itself is unchanged", async () => {
        const { data: after } = await staff
          .from("reservations")
          .select("id, tenant_id, status, date, start_time, updated_at")
          .eq("id", reservation.id)
          .single();
        assertEquals(after, reservation);
        const { data: pending } = await staff
          .from("reschedule_requests")
          .select("id")
          .eq("reservation_id", reservation.id)
          .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString());
        assertEquals(pending ?? [], [], "a change request was saved through a revoked link");
      });
    } finally {
      await staff.from("booking_tokens").delete().eq("token", token);
    }
  },
});
