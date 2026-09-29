import "../_shared/test-rate-limit-stub.ts";
// Pretend-backend tests with a frozen clock: a guest link is refused AT its
// exact expiry moment (not only after), works 1 ms before it, and a link that
// expires later keeps working at that same moment.
import { FakeTime } from "https://deno.land/std@0.224.0/testing/time.ts";
import { handleGuestBookingPortalRequest } from "./index.ts";

const EXPIRING = "e".repeat(64);
const LATER = "f".repeat(64);
const T = Date.parse("2099-06-01T12:00:00.000Z");
const RES = {
  id: "66666666-6666-4666-8666-666666666666",
  tenant_id: "77777777-7777-4777-8777-777777777777",
  status: "confirmed",
  date: "2099-07-01",
  start_time: "18:00:00",
  guest_name: "Exact Guest",
  guest_email: "exact@example.test",
};
const expiry: Record<string, string> = {
  [EXPIRING]: new Date(T).toISOString(),
  [LATER]: new Date(T + 60 * 60_000).toISOString(),
};

type Seen = { method: string; table: string };
function install() {
  const seen: Seen[] = [];
  const realFetch = globalThis.fetch;
  // Save the real values so later test files in the same run (live tests
  // that read SUPABASE_URL when they load) never see the fake address.
  const prevEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].map((k) => [k, Deno.env.get(k)] as const);
  Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key");
  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const table = url.pathname.split("/").pop() ?? "";
    seen.push({ method: req.method, table });
    const reply = (d: unknown, s = 200) =>
      Promise.resolve(new Response(d === null ? "" : JSON.stringify(d), {
        status: d === null ? 406 : s,
        headers: { "content-type": "application/json" },
      }));
    if (req.method === "GET" && table === "booking_tokens") {
      const tok = decodeURIComponent(url.searchParams.get("token") ?? "").replace(/^eq\./, "");
      if (!expiry[tok]) return reply(null);
      return reply({ reservation_id: RES.id, tenant_id: RES.tenant_id, is_revoked: false, expires_at: expiry[tok] });
    }
    if (req.method === "GET" && table === "reservations") return reply(RES);
    if (req.method === "GET") return reply(null);
    return reply({});
  }) as typeof fetch;
  return {
    seen,
    restore: () => {
      globalThis.fetch = realFetch;
      for (const [k, v] of prevEnv) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
    },
  };
}

let ip = 0;
async function send(token: string, body: Record<string, unknown>) {
  ip++;
  const res = await handleGuestBookingPortalRequest(new Request("https://example.test/guest-booking-portal", {
    method: "POST",
    headers: { "content-type": "application/json", Origin: "https://mimmobook.com", "x-forwarded-for": `10.9.${ip >> 8}.${ip & 255}` },
    body: JSON.stringify({ token, ...body }),
  }));
  return { status: res.status, json: await res.json() };
}
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

const VIEW = { action: "view" };
const RESCHEDULE = { action: "reschedule", requested_date: "2099-08-01" };
const CANCEL = { action: "cancel", language: "en" };
const opts = { sanitizeOps: false, sanitizeResources: false };

async function atClock(ms: number, fn: (b: ReturnType<typeof install>) => Promise<void>) {
  const time = new FakeTime(ms);
  const b = install();
  try { await fn(b); } finally { b.restore(); time.restore(); }
}

Deno.test({ ...opts, name: "exact expiry: 1 ms before its expiry the link still views the booking", fn: () =>
  atClock(T - 1, async () => {
    const r = await send(EXPIRING, VIEW);
    assert(r.json.ok === true, `expected ok, got ${JSON.stringify(r.json)}`);
  }) });

for (const [label, body] of [["view", VIEW], ["reschedule", RESCHEDULE], ["cancel", CANCEL]] as const) {
  Deno.test({ ...opts, name: `exact expiry: ${label} is refused at the exact expiry moment`, fn: () =>
    atClock(T, async (b) => {
      const r = await send(EXPIRING, body);
      if (label === "view") assert(r.json.ok === false && r.json.code === "expired", JSON.stringify(r.json));
      else assert(r.status === 403, `expected 403, got ${r.status} ${JSON.stringify(r.json)}`);
      const text = JSON.stringify(r.json);
      assert(!("reservation" in r.json) && !text.includes(RES.guest_name) && !text.includes(RES.guest_email), "booking details leaked");
      const past = b.seen.filter((s) => s.table !== "booking_tokens");
      assert(past.length === 0, `went past the link check: ${JSON.stringify(past)}`);
    }) });
}

Deno.test({ ...opts, name: "exact expiry: a link that expires later still works at that same moment", fn: () =>
  atClock(T, async () => {
    const refused = await send(EXPIRING, VIEW);
    assert(refused.json.code === "expired", JSON.stringify(refused.json));
    const later = await send(LATER, VIEW);
    assert(later.json.ok === true && later.json.reservation?.id === RES.id, `later link: ${JSON.stringify(later.json)}`);
  }) });

Deno.test({ ...opts, name: "exact expiry: the later link is refused at its own exact expiry moment", fn: () =>
  atClock(T + 60 * 60_000, async () => {
    const r = await send(LATER, VIEW);
    assert(r.json.ok === false && r.json.code === "expired", JSON.stringify(r.json));
  }) });
