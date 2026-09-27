// Integration test against a real backend: when staff turn off ONE guest
// booking link, the DEPLOYED guest-booking-portal refuses that link while
// every other link keeps working.
//
// Setup (as a signed-in owner/admin of a test business):
//   1. pick two existing active bookings in that business (read only),
//   2. store three fresh, working links: A and B on booking 1, C on booking 2,
//   3. staff turn off link A (the same update the app makes),
//   4. call the portal as a guest (publishable key, no sign-in):
//        A: view refused as "revoked", date change and cancel refused,
//        B (same booking) and C (other booking): view still works,
//   5. check both bookings are unchanged and the audit trail names the
//      staff member, then delete the three links.
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

// Same guard as revoked-token.integration.test.ts: pinned to a local
// backend when GUEST_PORTAL_TEST_BACKEND=local.
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
  name: "guest portal integration: revoking one link leaves the other links usable",
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
    let revokeStartedAt = 0;
    let revokeFinishedAt = 0;

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

      await t.step("staff turn off link A", async () => {
        revokeStartedAt = Date.now();
        const { error } = await staff
          .from("booking_tokens")
          .update({ is_revoked: true })
          .eq("id", idA);
        revokeFinishedAt = Date.now();
        assert(!error, `could not revoke link A: ${error?.message}`);
      });

      await t.step(
        "link A: view refused as revoked, no booking shown",
        async () => {
          const r = await guestCall({ action: "view", token: links.A.token });
          assertEquals(r.status, 200, r.text);
          const body = JSON.parse(r.text);
          assertEquals(body.ok, false, r.text);
          assertEquals(body.code, "revoked", r.text);
          assert(
            !("reservation" in body),
            `revoked link leaked booking data: ${r.text}`,
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

      await t.step("only link A is turned off in the database", async () => {
        const { data } = await staff
          .from("booking_tokens")
          .select("token, is_revoked")
          .in(
            "token",
            Object.values(links).map((l) => l.token),
          );
        const byToken = new Map(
          (data ?? []).map((d) => [d.token, d.is_revoked]),
        );
        assertEquals(byToken.get(links.A.token), true);
        assertEquals(byToken.get(links.B.token), false);
        assertEquals(byToken.get(links.C.token), false);
      });

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
          "a change request was saved through a revoked link",
        );
      });

      await t.step(
        "the audit trail records who turned off link A",
        async () => {
          const { data, error } = await staff
            .from("booking_token_revocation_audit")
            .select("booking_token_id, action, actor_user_id, actor_kind")
            .in(
              "booking_token_id",
              stored.map((s) => s.id),
            );
          // A throwaway backend built only from supabase/migrations may not
          // have the audit table; everywhere else it must be there.
          if (
            error?.code === "PGRST205" &&
            Deno.env.get("GUEST_PORTAL_TEST_BACKEND") === "local"
          ) {
            console.warn(
              "audit table missing on the local backend; audit step skipped",
            );
            return;
          }
          assert(!error, `could not read the audit trail: ${error?.message}`);
          assertEquals(data, [
            {
              booking_token_id: idA,
              action: "revoked",
              actor_user_id: userData.user.id,
              actor_kind: "staff",
            },
          ]);
        },
      );

      await t.step(
        "the revocation record names the staff member and time, never the link code",
        async () => {
          const { data, error } = await staff
            .from("booking_token_revocation_audit")
            .select("*")
            .eq("booking_token_id", idA)
            .eq("action", "revoked");
          if (
            error?.code === "PGRST205" &&
            Deno.env.get("GUEST_PORTAL_TEST_BACKEND") === "local"
          ) {
            console.warn(
              "audit table missing on the local backend; audit step skipped",
            );
            return;
          }
          assert(!error, `could not read the audit trail: ${error?.message}`);
          assertEquals(data?.length, 1, "expected exactly one revoke record");
          const row = data![0] as Record<string, unknown>;

          // Who: the signed-in staff member, with their email.
          assertEquals(row.actor_user_id, userData.user.id);
          assertEquals(row.actor_kind, "staff");
          assertEquals(
            String(row.actor_email ?? "").toLowerCase(),
            String(userData.user.email ?? "").toLowerCase(),
          );
          assertEquals(row.reservation_id, links.A.reservation.id);
          assertEquals(row.tenant_id, links.A.reservation.tenant_id);

          // When: set by the database at revoke time. Allow 2 minutes of
          // clock difference between this machine and the database.
          const at = Date.parse(String(row.occurred_at));
          assert(!Number.isNaN(at), `occurred_at is not a time: ${row.occurred_at}`);
          const slack = 120_000;
          assert(
            at >= revokeStartedAt - slack && at <= revokeFinishedAt + slack,
            `occurred_at ${row.occurred_at} is outside the revoke window`,
          );

          // Never the link code: no column holds it (or any part of it), in
          // any form, and the table has no token column at all.
          assert(!("token" in row), "audit record has a token column");
          const dump = JSON.stringify(row).toLowerCase();
          for (const l of Object.values(links)) {
            const tok = l.token.toLowerCase();
            assert(!dump.includes(tok), "audit record contains a link code");
            assert(
              !dump.includes(tok.slice(0, 16)) && !dump.includes(tok.slice(-16)),
              "audit record contains part of a link code",
            );
            assert(
              !dump.includes(btoa(l.token).toLowerCase()),
              "audit record contains an encoded link code",
            );
          }
          const known = new Set([
            "id",
            "booking_token_id",
            "reservation_id",
            "tenant_id",
            "action",
            "actor_user_id",
            "actor_email",
            "actor_kind",
            "occurred_at",
          ]);
          const extra = Object.keys(row).filter((k) => !known.has(k));
          assertEquals(
            extra,
            [],
            "audit table gained columns; check none can hold a link code",
          );
        },
      );
    } finally {
      // Runs even when a step failed; fails the test if any link is left.
      await deleteAndVerifyLinks(
        staff as unknown as CleanupClient,
        Object.values(links).map((l) => l.token),
      );
    }
  },
});
