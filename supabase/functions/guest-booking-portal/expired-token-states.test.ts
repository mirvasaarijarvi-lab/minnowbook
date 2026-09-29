import "../_shared/test-rate-limit-stub.ts";
// Regression tests: an expired guest booking link is refused for every
// booking state, booking type and action variant, before the booking is
// looked up, with no booking details in the reply and nothing written.
import { handleGuestBookingPortalRequest } from "./index.ts";

const TOKEN = "e".repeat(64);
const BASE = {
  id: "55555555-5555-4555-8555-555555555555",
  tenant_id: "99999999-9999-4999-8999-999999999999",
  date: "2099-02-02",
  start_time: "12:00:00",
  guest_name: "Expired State Guest",
  guest_email: "expired-state@example.test",
};

const STATES = ["pending", "confirmed", "completed", "no_show", "cancelled"] as const;
const TYPES = ["restaurant", "hotel", "catering", "custom"] as const;
const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const ACTIONS: Record<string, Record<string, unknown>> = {
  "view": { action: "view" },
  "new date only": { action: "reschedule", requested_date: FUTURE },
  "new date, time and note": {
    action: "reschedule",
    requested_date: FUTURE,
    requested_start_time: "20:00",
    requested_end_time: "22:00",
    guest_note: "Please move us",
  },
  "cancel (en)": { action: "cancel", language: "en" },
  "cancel with reason (fi)": { action: "cancel", language: "fi", reason: "Sairastuin" },
  "cancel with reason (sv)": { action: "cancel", language: "sv", reason: "Förhinder" },
};

type Seen = { method: string; table: string };

function installBackend(reservation: Record<string, unknown>, invoiced: boolean) {
  const seen: Seen[] = [];
  const realFetch = globalThis.fetch;
  const prev = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].map((k) => [k, Deno.env.get(k)] as const);
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
        reservation_id: BASE.id,
        tenant_id: BASE.tenant_id,
        is_revoked: false,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      });
    }
    if (req.method === "GET" && table === "reservations") return reply({ ...reservation, is_invoiced: invoiced });
    if (req.method === "GET") return reply(null);
    return reply({});
  }) as typeof fetch;
  return {
    seen,
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
        "x-forwarded-for": `10.9.${Math.floor(ip / 250)}.${ip % 250}`,
      },
      body: JSON.stringify({ token: TOKEN, ...body }),
    }),
  );
  return { status: res.status, json: await res.json() };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function expectRefused(body: Record<string, unknown>, label: string) {
  const r = await send(body);
  if (body.action === "view") {
    assert(r.json.ok === false && r.json.code === "expired", `${label}: ${r.status} ${JSON.stringify(r.json)}`);
  } else {
    assert(r.status === 403, `${label}: expected 403, got ${r.status} ${JSON.stringify(r.json)}`);
  }
  assert(!("reservation" in r.json) && !("request" in r.json), `${label}: booking data returned`);
  const text = JSON.stringify(r.json);
  for (const v of [BASE.guest_name, BASE.guest_email, BASE.date, BASE.id]) {
    assert(!text.includes(v), `${label}: reply contains "${v}"`);
  }
}

function assertUntouched(seen: Seen[], label: string) {
  const past = seen.filter((s) => s.table !== "booking_tokens");
  assert(past.length === 0, `${label}: went past the link check: ${JSON.stringify(past)}`);
  const writes = seen.filter((s) => s.method !== "GET" && s.method !== "HEAD");
  assert(writes.length === 0, `${label}: something was written: ${JSON.stringify(writes)}`);
}

const opts = { sanitizeOps: false, sanitizeResources: false };

for (const status of STATES) {
  Deno.test({
    ...opts,
    name: `expired + booking ${status}: every action variant is refused, nothing read past the link, nothing written`,
    fn: async () => {
      for (const type of TYPES) {
        const b = installBackend({ ...BASE, status, reservation_type: type }, false);
        try {
          for (const [name, body] of Object.entries(ACTIONS)) {
            await expectRefused(body, `${status}/${type}/${name}`);
          }
          assertUntouched(b.seen, `${status}/${type}`);
        } finally {
          b.restore();
        }
      }
    },
  });
}

Deno.test({
  ...opts,
  name: "expired + invoiced booking: every action variant is refused and nothing is written",
  fn: async () => {
    const b = installBackend({ ...BASE, status: "confirmed", reservation_type: "catering" }, true);
    try {
      for (const [name, body] of Object.entries(ACTIONS)) await expectRefused(body, `invoiced/${name}`);
      assertUntouched(b.seen, "invoiced");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "expired: every state and action mixed at the same moment are all refused",
  fn: async () => {
    const b = installBackend({ ...BASE, status: "confirmed", reservation_type: "restaurant" }, false);
    try {
      const bodies = Object.values(ACTIONS);
      await Promise.all(
        Array.from({ length: 18 }, (_, i) => expectRefused(bodies[i % bodies.length], `parallel ${i}`)),
      );
      assertUntouched(b.seen, "parallel");
    } finally {
      b.restore();
    }
  },
});
