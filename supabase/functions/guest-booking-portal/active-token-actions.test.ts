import "../_shared/test-rate-limit-stub.ts";
// Regression tests: an active guest booking link must keep working for the
// intended actions (view, ask for a new date, cancel), and each action must
// touch only the booking the link belongs to.
import { handleGuestBookingPortalRequest } from "./index.ts";

const TOKEN = "a".repeat(64);
const RESERVATION = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  status: "confirmed",
  reservation_type: "restaurant",
  date: "2099-01-01",
  start_time: "18:00:00",
  guest_name: "Active Guest",
  guest_email: "active@example.test",
};
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_TENANT = "44444444-4444-4444-8444-444444444444";
const SETTINGS = { business_name: "Test Venue", primary_color: "#123456", logo_url: null };

type Call = { method: string; table: string; query: string; body: any };

function installBackend(opts: { expiresInMs?: number; pendingRequest?: boolean } = {}) {
  const calls: Call[] = [];
  const state = {
    status: RESERVATION.status,
    revoked: false,
    pending: !!opts.pendingRequest,
    expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 7 * 86_400_000)).toISOString(),
  };
  const realFetch = globalThis.fetch;
  const prev = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].map((k) => [k, Deno.env.get(k)] as const);
  Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key");
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const table = url.pathname.split("/").pop() ?? "";
    const text = req.method === "GET" ? "" : await req.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: req.method, table, query: decodeURIComponent(url.search), body });
    const reply = (data: unknown, status = 200) =>
      new Response(data === null ? "" : JSON.stringify(data), {
        status: data === null ? 406 : status,
        headers: { "content-type": "application/json" },
      });
    if (req.method === "GET" && table === "booking_tokens") {
      return reply({
        reservation_id: RESERVATION.id,
        tenant_id: RESERVATION.tenant_id,
        is_revoked: state.revoked,
        expires_at: state.expiresAt,
      });
    }
    if (req.method === "GET" && table === "reservations") return reply({ ...RESERVATION, status: state.status });
    if (req.method === "GET" && table === "tenant_settings") return reply(SETTINGS);
    if (req.method === "GET" && table === "reschedule_requests") return reply(state.pending ? { id: "req-old" } : null);
    if (req.method === "GET") return reply(null);
    if (req.method === "POST" && table === "reschedule_requests") {
      state.pending = true;
      return reply({ id: "req-new", requested_date: body.requested_date, requested_start_time: body.requested_start_time, status: "pending" }, 201);
    }
    if (req.method === "PATCH" && table === "reservations" && body?.status) state.status = body.status;
    if (req.method === "PATCH" && table === "booking_tokens" && body?.is_revoked) state.revoked = true;
    return reply([], 200);
  }) as typeof fetch;
  return {
    calls,
    state,
    writes: () => calls.filter((c) => c.method !== "GET" && c.method !== "HEAD"),
    restore: () => {
      globalThis.fetch = realFetch;
      for (const [k, v] of prev) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
    },
  };
}

let ip = 0;
async function send(body: Record<string, unknown>) {
  ++ip;
  const res = await handleGuestBookingPortalRequest(
    new Request("https://example.test/guest-booking-portal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://mimmobook.com",
        "x-forwarded-for": `10.7.${Math.floor(ip / 250)}.${ip % 250}`,
      },
      body: JSON.stringify({ token: TOKEN, ...body }),
    }),
  );
  return { status: res.status, json: await res.json() };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const NEW_DATE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const opts = { sanitizeOps: false, sanitizeResources: false };

function assertOnlyOwnBooking(b: ReturnType<typeof installBackend>, label: string) {
  for (const c of b.calls) {
    assert(!c.query.includes(OTHER_ID) && !JSON.stringify(c.body ?? "").includes(OTHER_ID), `${label}: another booking was touched: ${JSON.stringify(c)}`);
    assert(!c.query.includes(OTHER_TENANT) && !JSON.stringify(c.body ?? "").includes(OTHER_TENANT), `${label}: another business was touched: ${JSON.stringify(c)}`);
  }
}

Deno.test({
  ...opts,
  name: "active: view shows the booking, the venue and the link's expiry, and changes nothing",
  fn: async () => {
    const b = installBackend();
    try {
      const r = await send({ action: "view" });
      assert(r.status === 200 && r.json.ok === true, `view failed: ${r.status} ${JSON.stringify(r.json)}`);
      assert(r.json.reservation.id === RESERVATION.id, "wrong booking returned");
      assert(r.json.reservation.guest_name === RESERVATION.guest_name, "guest name missing");
      assert(r.json.settings?.business_name === SETTINGS.business_name, "venue details missing");
      assert(r.json.token.is_revoked === false && r.json.token.expires_at === b.state.expiresAt, "link info wrong");
      const resQuery = b.calls.find((c) => c.table === "reservations")!.query;
      assert(resQuery.includes(RESERVATION.id) && resQuery.includes(RESERVATION.tenant_id), "booking not scoped to link's booking and business");
      assert(b.writes().length === 0, `view wrote something: ${JSON.stringify(b.writes())}`);
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "active: asking for a new date saves one request for this booking and tells staff",
  fn: async () => {
    const b = installBackend();
    try {
      const r = await send({ action: "reschedule", requested_date: NEW_DATE, requested_start_time: "19:30", guest_note: "Running late" });
      assert(r.status === 200 && r.json.ok === true, `reschedule failed: ${r.status} ${JSON.stringify(r.json)}`);
      assert(r.json.request?.status === "pending" && r.json.request.requested_date === NEW_DATE, `wrong request: ${JSON.stringify(r.json)}`);
      const saved = b.writes().filter((c) => c.table === "reschedule_requests" && c.method === "POST");
      assert(saved.length === 1, `expected 1 saved request, got ${saved.length}`);
      const row = Array.isArray(saved[0].body) ? saved[0].body[0] : saved[0].body;
      assert(row.reservation_id === RESERVATION.id && row.tenant_id === RESERVATION.tenant_id, "request not tied to this booking");
      assert(row.requested_date === NEW_DATE && String(row.requested_start_time).startsWith("19:30") && row.guest_note === "Running late", `request values wrong: ${JSON.stringify(row)}`);
      assert(b.writes().some((c) => c.table === "notifications" && c.method === "POST"), "staff were not notified");
      assert(!b.writes().some((c) => c.table === "reservations"), "the booking itself was changed");
      assert(b.state.status === "confirmed" && !b.state.revoked, "booking or link changed by a date request");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "active: a second date request while one is pending is refused, nothing saved",
  fn: async () => {
    const b = installBackend({ pendingRequest: true });
    try {
      const r = await send({ action: "reschedule", requested_date: NEW_DATE });
      assert(r.status === 409, `expected 409, got ${r.status} ${JSON.stringify(r.json)}`);
      assert(b.writes().length === 0, "something was saved");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "active: cancel cancels this booking, closes pending requests, retires the link and tells staff",
  fn: async () => {
    const b = installBackend({ pendingRequest: true });
    try {
      const r = await send({ action: "cancel", reason: "Plans changed", language: "fi" });
      assert(r.status === 200 && r.json.ok === true && !r.json.alreadyCancelled, `cancel failed: ${r.status} ${JSON.stringify(r.json)}`);
      const upd = b.writes().filter((c) => c.table === "reservations" && c.method === "PATCH");
      assert(upd.length === 1 && upd[0].body.status === "cancelled", "booking not cancelled once");
      assert(upd[0].query.includes(RESERVATION.id) && upd[0].query.includes(RESERVATION.tenant_id), "cancel not scoped to this booking");
      assert(String(upd[0].body.internal_notes).includes("Plans changed"), "reason not recorded");
      assert(b.writes().some((c) => c.table === "reschedule_requests" && c.method === "PATCH" && c.body.status === "cancelled"), "pending request not closed");
      assert(b.state.revoked, "link still active after cancelling");
      assert(b.writes().some((c) => c.table === "notifications" && c.method === "POST"), "staff were not notified");

      const again = await send({ action: "view" });
      assert(again.json.ok === false && again.json.code === "revoked", "link still opens the cancelled booking");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "active: full guest journey works in order (view, new date, view again, cancel)",
  fn: async () => {
    const b = installBackend();
    try {
      assert((await send({ action: "view" })).json.ok === true, "first view");
      assert((await send({ action: "reschedule", requested_date: NEW_DATE })).json.ok === true, "reschedule");
      assert((await send({ action: "view" })).json.ok === true, "view after date request");
      assert((await send({ action: "cancel", language: "sv" })).json.ok === true, "cancel");
      assertOnlyOwnBooking(b, "journey");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "active: a link expiring in 1 minute still allows every action",
  fn: async () => {
    const b = installBackend({ expiresInMs: 60_000 });
    try {
      assert((await send({ action: "view" })).json.ok === true, "view");
      assert((await send({ action: "reschedule", requested_date: NEW_DATE })).json.ok === true, "reschedule");
      assert((await send({ action: "cancel", language: "en" })).json.ok === true, "cancel");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "active: another booking's id or business sent with the link is ignored; actions apply to the link's booking",
  fn: async () => {
    const b = installBackend();
    try {
      const extra = { reservation_id: OTHER_ID, tenant_id: OTHER_TENANT };
      const v = await send({ action: "view", ...extra });
      assert(v.json.ok === true && v.json.reservation.id === RESERVATION.id, "view returned the wrong booking");
      assert((await send({ action: "reschedule", requested_date: NEW_DATE, ...extra })).json.ok === true, "reschedule");
      assert((await send({ action: "cancel", language: "en", ...extra })).json.ok === true, "cancel");
      assertOnlyOwnBooking(b, "extra fields");
    } finally {
      b.restore();
    }
  },
});
