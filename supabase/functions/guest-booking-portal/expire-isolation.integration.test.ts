// Integration test against a real backend: when ONE guest booking link has
// expired, the DEPLOYED guest-booking-portal refuses that link while every
// other (still active) link keeps working.
//
// Setup (as a signed-in owner/admin of a test business):
//   1. pick two existing active bookings in that business (read only),
//   2. store three fresh, working links: A and B on booking 1, C on booking 2,
//   3. move link A's expiry one minute into the past,
//   4. call the portal as a guest (publishable key, no sign-in):
//        A: view refused as "expired", date change and cancel refused,
//        B (same booking) and C (other booking): view still works,
//   5. check both bookings are unchanged and link A is expired but NOT
//      turned off (expiry alone denies it), then delete the three links.
// Links B and C are only viewed: changing or cancelling a real booking is
// never attempted with a working link.
//
// Needs SUPABASE_URL + a publishable key, and an owner/admin access token in
// GUEST_PORTAL_TEST_ACCESS_TOKEN (falls back to ADMIN_USERS_TEST_ACCESS_TOKEN).
// Self-skips when any is missing.
import { createClient } from "npm:@supabase/supabase-js@2";
import { deleteAndVerifyLinks, maybeForcedFailure, type CleanupClient } from "./test-link-cleanup.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_BASE =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const STAFF_TOKEN =
  Deno.env.get("GUEST_PORTAL_TEST_ACCESS_TOKEN") ??
  Deno.env.get("ADMIN_USERS_TEST_ACCESS_TOKEN");
const ENABLED = !!URL_BASE && !!KEY && !!STAFF_TOKEN;

// Pinned to a local backend when GUEST_PORTAL_TEST_BACKEND=local.
if (Deno.env.get("GUEST_PORTAL_TEST_BACKEND") === "local" && URL_BASE) {
  const host = new URL(URL_BASE).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `GUEST_PORTAL_TEST_BACKEND=local but SUPABASE_URL host is ${host}`,
    );
  }
}

const COLS = "id, tenant_id, status, date, start_time, updated_at";

function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function guestCall(body: Record<string, unknown>) {
  const res = await fetch(`${URL_BASE}/functions/v1/guest-booking-portal`, {
    method: "POST",
    headers: {
      apikey: KEY!,
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

Deno.test({
  name: "guest portal integration: an expired link is refused while active links stay usable",
  ignore: !ENABLED,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const staff = createClient(URL_BASE!, KEY!, {
      global: { headers: { Authorization: `Bearer ${STAFF_TOKEN}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } =
      await staff.auth.getUser(STAFF_TOKEN);
    assert(
      !userErr && userData.user,
      `staff token rejected: ${userErr?.message}`,
    );
    const { data: membership } = await staff
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .in("role", ["superadmin", "owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (!membership)
      throw new Error("test login is not an owner/admin of any business");

    const { data: bookings } = await staff
      .from("reservations")
      .select(COLS)
      .eq("tenant_id", membership.tenant_id)
      .neq("status", "cancelled")
      .order("date", { ascending: false })
      .limit(2);
    if (!bookings || bookings.length < 2) {
      throw new Error("the test business needs two active bookings");
    }
    const [one, two] = bookings;

    const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const links = {
      A: { token: newToken(), reservation: one },
      B: { token: newToken(), reservation: one },
      C: { token: newToken(), reservation: two },
    };
    const { data: stored, error: insErr } = await staff
      .from("booking_tokens")
      .insert(
        Object.values(links).map((l) => ({
          token: l.token,
          reservation_id: l.reservation.id,
          tenant_id: l.reservation.tenant_id,
          expires_at: expires,
        })),
      )
      .select("id, token");
    assert(
      !insErr && stored?.length === 3,
      `could not store test links: ${insErr?.message}`,
    );
    const idA = stored.find((s) => s.token === links.A.token)!.id;

    try {
      await maybeForcedFailure(t);
      await t.step(
        "before: all three links can view their booking",
        async () => {
          for (const [name, l] of Object.entries(links)) {
            const r = await guestCall({ action: "view", token: l.token });
            const body = JSON.parse(r.text);
            assertEquals(body.ok, true, `link ${name}: ${r.text}`);
          }
        },
      );

      await t.step("link A expires", async () => {
        const { error } = await staff
          .from("booking_tokens")
          .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
          .eq("id", idA);
        assert(!error, `could not expire link A: ${error?.message}`);
      });

      await t.step(
        "link A: view refused as expired, no booking shown",
        async () => {
          const r = await guestCall({ action: "view", token: links.A.token });
          assertEquals(r.status, 200, r.text);
          const body = JSON.parse(r.text);
          assertEquals(body.ok, false, r.text);
          assertEquals(body.code, "expired", r.text);
          assert(
            !("reservation" in body),
            `expired link leaked booking data: ${r.text}`,
          );
        },
      );

      await t.step(
        "link A: changing the date and cancelling are refused",
        async () => {
          const date = new Date(Date.now() + 30 * 86_400_000)
            .toISOString()
            .slice(0, 10);
          const re = await guestCall({
            action: "reschedule",
            token: links.A.token,
            requested_date: date,
          });
          assertEquals(re.status, 403, re.text);
          const ca = await guestCall({
            action: "cancel",
            token: links.A.token,
            language: "en",
          });
          assertEquals(ca.status, 403, ca.text);
        },
      );

      await t.step(
        "link B (same booking) and link C (other booking) still work",
        async () => {
          for (const name of ["B", "C"] as const) {
            const l = links[name];
            const r = await guestCall({ action: "view", token: l.token });
            assertEquals(r.status, 200, r.text);
            const body = JSON.parse(r.text);
            assertEquals(
              body.ok,
              true,
              `link ${name} stopped working: ${r.text}`,
            );
            assertEquals(
              body.reservation?.id,
              l.reservation.id,
              `link ${name} showed the wrong booking`,
            );
          }
        },
      );

      await t.step(
        "link A is expired but not turned off; B and C are untouched",
        async () => {
          const { data } = await staff
            .from("booking_tokens")
            .select("token, is_revoked, expires_at")
            .in(
              "token",
              Object.values(links).map((l) => l.token),
            );
          const byToken = new Map((data ?? []).map((d) => [d.token, d]));
          const a = byToken.get(links.A.token)!;
          assertEquals(a.is_revoked, false, "expiry must deny without revoking");
          assert(Date.parse(a.expires_at) < Date.now(), "link A should be expired");
          for (const n of ["B", "C"] as const) {
            const l = byToken.get(links[n].token)!;
            assertEquals(l.is_revoked, false, `link ${n} was turned off`);
            assertEquals(
              Date.parse(l.expires_at),
              Date.parse(expires),
              `link ${n} expiry changed`,
            );
          }
        },
      );

      await t.step("both bookings are unchanged", async () => {
        const { data: after } = await staff
          .from("reservations")
          .select(COLS)
          .in("id", [one.id, two.id]);
        const byId = new Map((after ?? []).map((r) => [r.id, r]));
        assertEquals(byId.get(one.id), one);
        assertEquals(byId.get(two.id), two);
        const { data: pending } = await staff
          .from("reschedule_requests")
          .select("id")
          .eq("reservation_id", one.id)
          .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString());
        assertEquals(
          pending ?? [],
          [],
          "a change request was saved through an expired link",
        );
      });
    } finally {
      // Runs even when a step failed; fails the test if any link is left.
      await deleteAndVerifyLinks(
        staff as unknown as CleanupClient,
        Object.values(links).map((l) => l.token),
      );
    }
  },
});
