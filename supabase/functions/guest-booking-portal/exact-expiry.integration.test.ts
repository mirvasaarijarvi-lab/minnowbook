// Integration test against a real backend: a guest link is refused from its
// exact expiry moment, while a link on the same booking that expires later
// keeps working at that same moment.
//
// Setup (as a signed-in owner/admin of a test business):
//   1. pick one existing active booking (read only),
//   2. store link A expiring at T (a whole second ~6 s ahead) and link B
//      expiring at T + 1 hour,
//   3. before T: both links view the booking,
//   4. wait until the local clock reaches T exactly, then immediately:
//      A view refused as "expired" (no booking data), date change + cancel
//      refused; B still views the booking,
//   5. check the stored expiry of A is exactly T (the database did not round
//      it), B is unchanged, the booking is unchanged; delete both links.
// Link B is only viewed: a real booking is never changed or cancelled.
//
// The exact-millisecond boundary is proven by exact-expiry.test.ts (frozen
// clock). Here the server clock may differ from ours by a little, so if the
// server answers "before T" we retry until it is at or past T (max 3 s).
//
// Needs SUPABASE_URL + a publishable key and GUEST_PORTAL_TEST_ACCESS_TOKEN
// (falls back to ADMIN_USERS_TEST_ACCESS_TOKEN). Self-skips otherwise.
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

if (Deno.env.get("GUEST_PORTAL_TEST_BACKEND") === "local" && URL_BASE) {
  const host = new URL(URL_BASE).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`GUEST_PORTAL_TEST_BACKEND=local but SUPABASE_URL host is ${host}`);
  }
}

const COLS = "id, tenant_id, status, date, start_time, updated_at";
const newToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function guestCall(body: Record<string, unknown>) {
  const res = await fetch(`${URL_BASE}/functions/v1/guest-booking-portal`, {
    method: "POST",
    headers: { apikey: KEY!, "Content-Type": "application/json", Origin: "https://mimmobook.com" },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.test({
  name: "guest portal integration: a link is refused at its exact expiry while a later-expiring link works",
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
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .in("role", ["superadmin", "owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (!membership) throw new Error("test login is not an owner/admin of any business");

    const { data: bookings } = await staff
      .from("reservations")
      .select(COLS)
      .eq("tenant_id", membership.tenant_id)
      .neq("status", "cancelled")
      .order("date", { ascending: false })
      .limit(1);
    if (!bookings?.length) throw new Error("the test business needs an active booking");
    const [booking] = bookings;

    const T = Math.ceil((Date.now() + 6_000) / 1000) * 1000;
    const tA = new Date(T).toISOString();
    const tB = new Date(T + 3_600_000).toISOString();
    const A = newToken();
    const B = newToken();
    const { data: stored, error: insErr } = await staff
      .from("booking_tokens")
      .insert([
        { token: A, reservation_id: booking.id, tenant_id: booking.tenant_id, expires_at: tA },
        { token: B, reservation_id: booking.id, tenant_id: booking.tenant_id, expires_at: tB },
      ])
      .select("id, token");
    assert(!insErr && stored?.length === 2, `could not store test links: ${insErr?.message}`);

    try {
      await t.step("before the expiry moment both links view the booking", async () => {
        assert(Date.now() < T - 1_000, "setup took too long; expiry moment already close");
        for (const [name, tok] of [["A", A], ["B", B]]) {
          const r = await guestCall({ action: "view", token: tok });
          const body = JSON.parse(r.text);
          assertEquals(body.ok, true, `link ${name}: ${r.text}`);
          assertEquals(body.reservation?.id, booking.id, `link ${name} opened another booking`);
        }
      });

      await t.step("the stored expiry of link A is exactly the chosen moment", async () => {
        const { data } = await staff.from("booking_tokens").select("token, expires_at").in("token", [A, B]);
        const byTok = new Map((data ?? []).map((r) => [r.token, Date.parse(r.expires_at)]));
        assertEquals(byTok.get(A), T, "link A expiry was rounded or changed");
        assertEquals(byTok.get(B), T + 3_600_000, "link B expiry was rounded or changed");
      });

      let firstRefusalAt = 0;
      await t.step("at the exact expiry moment link A is refused as expired", async () => {
        while (Date.now() < T) await sleep(Math.min(50, T - Date.now()));
        const sentAt = Date.now();
        let r = await guestCall({ action: "view", token: A });
        let body = JSON.parse(r.text);
        // Server clock may lag ours slightly: retry briefly until it is at T.
        const deadline = T + 3_000;
        while (body.ok === true && Date.now() < deadline) {
          await sleep(100);
          r = await guestCall({ action: "view", token: A });
          body = JSON.parse(r.text);
        }
        firstRefusalAt = Date.now();
        assertEquals(body.ok, false, `link A still works after its expiry: ${r.text}`);
        assertEquals(body.code, "expired", r.text);
        assert(!("reservation" in body), "booking details shown through the expired link");
        console.log(`first view sent ${sentAt - T} ms after T; refusal confirmed ${firstRefusalAt - T} ms after T`);
      });

      await t.step("link A cannot change the date or cancel at that moment", async () => {
        const res = await guestCall({ action: "reschedule", token: A, requested_date: booking.date });
        assertEquals(res.status, 403, `reschedule: ${res.text}`);
        const cancel = await guestCall({ action: "cancel", token: A, language: "en" });
        assertEquals(cancel.status, 403, `cancel: ${cancel.text}`);
      });

      await t.step("link B, which expires later, still views the booking", async () => {
        assert(Date.now() < T + 3_600_000, "link B already expired");
        const r = await guestCall({ action: "view", token: B });
        const body = JSON.parse(r.text);
        assertEquals(body.ok, true, `link B: ${r.text}`);
        assertEquals(body.reservation?.id, booking.id);
      });

      await t.step("expiry alone denied A; B and the booking are unchanged", async () => {
        const { data } = await staff.from("booking_tokens").select("token, is_revoked, expires_at").in("token", [A, B]);
        const byTok = new Map((data ?? []).map((r) => [r.token, r]));
        assertEquals(byTok.get(A)?.is_revoked, false, "link A was turned off instead of just expiring");
        assertEquals(Date.parse(byTok.get(A)!.expires_at), T);
        assertEquals(byTok.get(B)?.is_revoked, false);
        assertEquals(Date.parse(byTok.get(B)!.expires_at), T + 3_600_000);
        const { data: after } = await staff.from("reservations").select(COLS).eq("id", booking.id).single();
        assertEquals(after, booking);
        const { data: pending } = await staff
          .from("reschedule_requests")
          .select("id")
          .eq("reservation_id", booking.id)
          .gte("created_at", new Date(T - 60_000).toISOString());
        assertEquals(pending ?? [], [], "a change request was saved through the expired link");
      });
    } finally {
      await staff.from("booking_tokens").delete().in("token", [A, B]);
    }
  },
});
