// Regression tests: expired and revoked guest booking links must never show,
// change or cancel a booking. The backend is replaced by a stubbed fetch so
// each test controls the stored link and can see every request the portal makes.
import { handleGuestBookingPortalRequest } from "./index.ts";

const TOKEN = "b".repeat(64);
const RESERVATION = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  status: "confirmed",
  date: "2099-01-01",
  start_time: "18:00:00",
  guest_name: "Test Guest",
  guest_email: "guest@example.test",
};

type TokenRow = { is_revoked: boolean; expires_at: string };
type Seen = { method: string; table: string };

let ipCounter = 0;

async function call(
  body: Record<string, unknown>,
  tokenRow: TokenRow,
  reservation: Record<string, unknown> = RESERVATION,
): Promise<{ status: number; json: any; seen: Seen[] }> {
  const seen: Seen[] = [];
  const realFetch = globalThis.fetch;
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key");

  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const table = url.pathname.split("/").pop() ?? "";
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
        ...tokenRow,
      });
    }
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
          "x-forwarded-for": `10.0.0.${++ipCounter}`,
        },
        body: JSON.stringify({ token: TOKEN, ...body }),
      }),
    );
    return { status: res.status, json: await res.json(), seen };
  } finally {
    globalThis.fetch = realFetch;
    prevUrl === undefined ? Deno.env.delete("SUPABASE_URL") : Deno.env.set("SUPABASE_URL", prevUrl);
    prevKey === undefined
      ? Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY")
      : Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
}

const future = () => new Date(Date.now() + 86_400_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();
const EXPIRED: () => TokenRow = () => ({ is_revoked: false, expires_at: past() });
const REVOKED: () => TokenRow = () => ({ is_revoked: true, expires_at: future() });
const VALID: () => TokenRow = () => ({ is_revoked: false, expires_at: future() });

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function noBookingAccess(seen: Seen[], label: string) {
  const touched = seen.filter((s) => s.table !== "booking_tokens");
  assert(
    touched.length === 0,
    `${label}: portal went past the link check: ${JSON.stringify(touched)}`,
  );
}

const RESCHEDULE = {
  action: "reschedule",
  // Within the portal's allowed window (future, under 400 days ahead).
  requested_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
};
const CANCEL = { action: "cancel", language: "en" };

Deno.test("control: a valid link shows the booking", async () => {
  const r = await call({ action: "view" }, VALID());
  assert(r.status === 200 && r.json.ok === true, `expected ok, got ${JSON.stringify(r.json)}`);
  assert(r.json.reservation?.id === RESERVATION.id, "valid link should return its booking");
});

Deno.test("view: an expired link is refused with code expired", async () => {
  const r = await call({ action: "view" }, EXPIRED());
  assert(r.json.ok === false && r.json.code === "expired", JSON.stringify(r.json));
  assert(!("reservation" in r.json), "expired link leaked booking data");
  noBookingAccess(r.seen, "view expired");
});

Deno.test("view: a revoked link is refused with code revoked", async () => {
  const r = await call({ action: "view" }, REVOKED());
  assert(r.json.ok === false && r.json.code === "revoked", JSON.stringify(r.json));
  assert(!("reservation" in r.json), "revoked link leaked booking data");
  noBookingAccess(r.seen, "view revoked");
});

Deno.test("view: revoked wins even when the link has also expired", async () => {
  const r = await call({ action: "view" }, { is_revoked: true, expires_at: past() });
  assert(r.json.code === "revoked", JSON.stringify(r.json));
  noBookingAccess(r.seen, "view revoked+expired");
});

Deno.test("view: a valid link to a cancelled booking is treated as revoked", async () => {
  const r = await call({ action: "view" }, VALID(), { ...RESERVATION, status: "cancelled" });
  assert(r.json.ok === false && r.json.code === "revoked", JSON.stringify(r.json));
  assert(!("reservation" in r.json), "cancelled booking leaked through an old link");
});

for (const [name, row] of [["expired", EXPIRED], ["revoked", REVOKED]] as const) {
  Deno.test(`reschedule: a link that is ${name} is refused and nothing is saved`, async () => {
    const r = await call(RESCHEDULE, row());
    assert(r.status === 403, `expected 403, got ${r.status}`);
    noBookingAccess(r.seen, `reschedule ${name}`);
  });

  Deno.test(`cancel: a link that is ${name} is refused and the booking is untouched`, async () => {
    const r = await call(CANCEL, row());
    assert(r.status === 403, `expected 403, got ${r.status}`);
    noBookingAccess(r.seen, `cancel ${name}`);
  });
}
