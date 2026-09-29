import "../_shared/test-rate-limit-stub.ts";
// Regression tests: once a guest booking link is revoked, replaying it (again
// and again, across view / reschedule / cancel, in parallel, or with extra
// fields) must never show, change or cancel the booking. The backend is a
// stubbed fetch holding one link whose revoked flag each test controls.
import { handleGuestBookingPortalRequest } from "./index.ts";

const TOKEN = "c".repeat(64);
const RESERVATION = {
  id: "33333333-3333-4333-8333-333333333333",
  tenant_id: "44444444-4444-4444-8444-444444444444",
  status: "confirmed",
  date: "2099-01-01",
  start_time: "18:00:00",
  guest_name: "Test Guest",
  guest_email: "guest@example.test",
};
const OTHER_RESERVATION_ID = "55555555-5555-4555-8555-555555555555";

type Seen = { method: string; table: string; query: string };
type Backend = { seen: Seen[]; state: { revoked: boolean }; restore: () => void };

function installBackend(revoked: boolean): Backend {
  const seen: Seen[] = [];
  const state = { revoked };
  const realFetch = globalThis.fetch;
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key");

  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const table = url.pathname.split("/").pop() ?? "";
    seen.push({ method: req.method, table, query: url.search });
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
        is_revoked: state.revoked,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    if (req.method === "GET" && table === "reservations") return reply(RESERVATION);
    if (req.method === "GET") return reply(null);
    return reply({});
  }) as typeof fetch;

  return {
    seen,
    state,
    restore: () => {
      globalThis.fetch = realFetch;
      prevUrl === undefined ? Deno.env.delete("SUPABASE_URL") : Deno.env.set("SUPABASE_URL", prevUrl);
      prevKey === undefined
        ? Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY")
        : Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
    },
  };
}

let ipCounter = 0;
async function send(body: Record<string, unknown>) {
  const res = await handleGuestBookingPortalRequest(
    new Request("https://example.test/guest-booking-portal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://mimmobook.com",
        "x-forwarded-for": `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`,
      },
      body: JSON.stringify({ token: TOKEN, ...body }),
    }),
  );
  return { status: res.status, json: await res.json() };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const VIEW = { action: "view" };
const RESCHEDULE = {
  action: "reschedule",
  requested_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
};
const CANCEL = { action: "cancel", language: "en" };
const ACTIONS = [VIEW, RESCHEDULE, CANCEL] as const;

async function expectRefused(body: Record<string, unknown>, label: string) {
  const r = await send(body);
  if (body.action === "view") {
    assert(r.json.ok === false && r.json.code === "revoked", `${label}: ${JSON.stringify(r.json)}`);
  } else {
    assert(r.status === 403, `${label}: expected 403, got ${r.status} ${JSON.stringify(r.json)}`);
  }
  assert(!("reservation" in r.json), `${label}: booking details leaked`);
}

/** Nothing past the link lookup was read, and nothing was written at all. */
function assertUntouched(b: Backend, label: string) {
  const past = b.seen.filter((s) => s.table !== "booking_tokens");
  assert(past.length === 0, `${label}: went past the link check: ${JSON.stringify(past)}`);
  const writes = b.seen.filter((s) => s.method !== "GET" && s.method !== "HEAD");
  assert(writes.length === 0, `${label}: something was written: ${JSON.stringify(writes)}`);
}

const opts = { sanitizeOps: false, sanitizeResources: false };

Deno.test({
  ...opts,
  name: "replay: the same revoked link is refused every time across 3 rounds of view, reschedule, cancel",
  fn: async () => {
    const b = installBackend(true);
    try {
      for (let round = 1; round <= 3; round++) {
        for (const a of ACTIONS) await expectRefused(a, `round ${round} ${a.action}`);
      }
      assertUntouched(b, "sequential replay");
      const lookups = b.seen.filter((s) => s.table === "booking_tokens").length;
      assert(lookups === 9, `link should be checked on every one of 9 requests, was checked ${lookups} times`);
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "replay: a link that worked stops working the moment it is revoked, including the exact earlier request",
  fn: async () => {
    const b = installBackend(false);
    try {
      const first = await send(VIEW);
      assert(first.json.ok === true && first.json.reservation?.id === RESERVATION.id, "control: valid link should open");
      b.state.revoked = true;
      b.seen.length = 0;
      await expectRefused(VIEW, "replayed view after revoke");
      await expectRefused(RESCHEDULE, "reschedule after revoke");
      await expectRefused(CANCEL, "cancel after revoke");
      await expectRefused(VIEW, "view again after revoke");
      assertUntouched(b, "after revoke");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "replay: 12 simultaneous replays of a revoked link are all refused",
  fn: async () => {
    const b = installBackend(true);
    try {
      const bodies = Array.from({ length: 12 }, (_, i) => ACTIONS[i % 3]);
      const results = await Promise.all(bodies.map((body) => send(body)));
      results.forEach((r, i) => {
        const body = bodies[i];
        const ok = body.action === "view" ? r.json.code === "revoked" : r.status === 403;
        assert(ok && !("reservation" in r.json), `parallel ${i} ${body.action}: ${r.status} ${JSON.stringify(r.json)}`);
      });
      assertUntouched(b, "parallel replay");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "replay: extra fields (another booking's id, a different guest email, a status) do not get a revoked link through",
  fn: async () => {
    const b = installBackend(true);
    try {
      const extras = [
        { reservation_id: OTHER_RESERVATION_ID },
        { reservation_id: RESERVATION.id },
        { guest_email: "someone-else@example.test" },
        { is_revoked: false, status: "confirmed" },
      ];
      for (const extra of extras) {
        for (const a of ACTIONS) await expectRefused({ ...a, ...extra }, `${a.action} + ${JSON.stringify(extra)}`);
      }
      assertUntouched(b, "replay with extra fields");
      const otherLookups = b.seen.filter((s) => s.query.includes(OTHER_RESERVATION_ID));
      assert(otherLookups.length === 0, "another booking was looked up");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "replay: a revoked link with spaces around it is still refused",
  fn: async () => {
    const b = installBackend(true);
    try {
      for (const a of ACTIONS) await expectRefused({ ...a, token: `  ${TOKEN}\n` }, `padded ${a.action}`);
      assertUntouched(b, "padded replay");
    } finally {
      b.restore();
    }
  },
});
