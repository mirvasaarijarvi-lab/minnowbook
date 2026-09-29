import "../_shared/test-rate-limit-stub.ts";
// Regression tests: a guest booking link must stop working once its booking
// is cancelled or deleted, even while the link itself is still valid.
// The backend is a stubbed fetch; every request the portal makes is recorded.
import { handleGuestBookingPortalRequest } from "./index.ts";

const TOKEN = "c".repeat(64);
const RESERVATION = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  status: "confirmed",
  date: "2099-01-01",
  start_time: "18:00:00",
  guest_name: "Test Guest",
  guest_email: "guest@example.test",
};
const CANCELLED = { ...RESERVATION, status: "cancelled" };
type Seen = { method: string; table: string };
let ip = 0;

async function call(body: Record<string, unknown>, reservation: Record<string, unknown> | null) {
  const seen: Seen[] = [];
  const realFetch = globalThis.fetch;
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key");
  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const table = new URL(req.url).pathname.split("/").pop() ?? "";
    seen.push({ method: req.method, table });
    const reply = (data: unknown) =>
      Promise.resolve(
        new Response(data === null ? "" : JSON.stringify(data), {
          status: data === null ? 406 : 200,
          headers: { "content-type": "application/json" },
        }),
      );
    if (req.method === "GET" && table === "booking_tokens") {
      return reply({
        reservation_id: RESERVATION.id,
        tenant_id: RESERVATION.tenant_id,
        is_revoked: false,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    // null = the booking was deleted, so the database finds no row.
    if (req.method === "GET" && table === "reservations") return reply(reservation);
    if (req.method === "GET") return reply(null);
    return reply({});
  }) as typeof fetch;
  try {
    const res = await handleGuestBookingPortalRequest(
      new Request("https://example.test/guest-booking-portal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: "https://mimmobook.com",
          "x-forwarded-for": `10.2.0.${++ip}`,
        },
        body: JSON.stringify({ token: TOKEN, ...body }),
      }),
    );
    return { status: res.status, json: await res.json(), seen };
  } finally {
    globalThis.fetch = realFetch;
    prevUrl === undefined ? Deno.env.delete("SUPABASE_URL") : Deno.env.set("SUPABASE_URL", prevUrl);
    prevKey === undefined ? Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY") : Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const noWrites = (seen: Seen[], label: string) => {
  const writes = seen.filter((s) => s.method !== "GET");
  assert(writes.length === 0, `${label}: something was written: ${JSON.stringify(writes)}`);
};

const VIEW = { action: "view" };
const RESCHEDULE = {
  action: "reschedule",
  requested_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
};
const CANCEL = { action: "cancel", language: "en" };

Deno.test("control: an active booking is shown and can be cancelled", async () => {
  const v = await call(VIEW, RESERVATION);
  assert(v.status === 200 && v.json.reservation?.id === RESERVATION.id, JSON.stringify(v.json));
  const c = await call(CANCEL, RESERVATION);
  assert(c.seen.some((s) => s.method === "PATCH" && s.table === "reservations"), "control cancel should update the booking");
});

// ---- Cancelled booking ----
Deno.test("cancelled booking: view is refused as revoked with no details", async () => {
  const r = await call(VIEW, CANCELLED);
  assert(r.json.ok === false && r.json.code === "revoked", JSON.stringify(r.json));
  assert(!("reservation" in r.json), "cancelled booking leaked details");
  noWrites(r.seen, "view cancelled");
});

Deno.test("cancelled booking: a new date cannot be requested", async () => {
  const r = await call(RESCHEDULE, CANCELLED);
  assert(r.status === 409, `expected 409, got ${r.status} ${JSON.stringify(r.json)}`);
  noWrites(r.seen, "reschedule cancelled");
  assert(!r.seen.some((s) => s.table === "reschedule_requests"), "reschedule requests were touched");
});

Deno.test("cancelled booking: cancelling again changes nothing", async () => {
  const r = await call(CANCEL, CANCELLED);
  assert(r.json.alreadyCancelled === true, JSON.stringify(r.json));
  noWrites(r.seen, "cancel cancelled");
});

// ---- Deleted booking ----
Deno.test("deleted booking: view says not found with no details", async () => {
  const r = await call(VIEW, null);
  assert(r.json.ok === false && r.json.code === "not_found", JSON.stringify(r.json));
  assert(!("reservation" in r.json), "deleted booking returned details");
  noWrites(r.seen, "view deleted");
});

Deno.test("deleted booking: a new date cannot be requested", async () => {
  const r = await call(RESCHEDULE, null);
  assert(r.status === 404, `expected 404, got ${r.status} ${JSON.stringify(r.json)}`);
  noWrites(r.seen, "reschedule deleted");
});

Deno.test("deleted booking: cancel is refused and nothing is written", async () => {
  const r = await call(CANCEL, null);
  assert(r.status === 404, `expected 404, got ${r.status} ${JSON.stringify(r.json)}`);
  noWrites(r.seen, "cancel deleted");
});
