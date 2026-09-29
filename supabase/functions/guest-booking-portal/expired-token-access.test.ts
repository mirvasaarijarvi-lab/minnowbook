import "../_shared/test-rate-limit-stub.ts";
// Regression tests: expired guest booking links must never show, change or
// cancel a booking, including right at the expiry moment, when replayed, when
// a link expires after it worked, and when extra fields are sent with it.
import { handleGuestBookingPortalRequest } from "./index.ts";

const TOKEN = "d".repeat(64);
const RESERVATION = {
  id: "66666666-6666-4666-8666-666666666666",
  tenant_id: "77777777-7777-4777-8777-777777777777",
  status: "confirmed",
  date: "2099-01-01",
  start_time: "18:00:00",
  guest_name: "Test Guest",
  guest_email: "guest@example.test",
};
const OTHER_RESERVATION_ID = "88888888-8888-4888-8888-888888888888";

type Seen = { method: string; table: string; query: string };

function installBackend(expiresAt: () => string) {
  const seen: Seen[] = [];
  const state = { expiresAt };
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
        is_revoked: false,
        expires_at: state.expiresAt(),
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
  ++ipCounter;
  const res = await handleGuestBookingPortalRequest(
    new Request("https://example.test/guest-booking-portal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://mimmobook.com",
        "x-forwarded-for": `10.2.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
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
const ago = (ms: number) => () => new Date(Date.now() - ms).toISOString();

async function expectRefused(body: Record<string, unknown>, label: string) {
  const r = await send(body);
  if (body.action === "view") {
    assert(r.json.ok === false && r.json.code === "expired", `${label}: ${JSON.stringify(r.json)}`);
  } else {
    assert(r.status === 403, `${label}: expected 403, got ${r.status} ${JSON.stringify(r.json)}`);
  }
  assert(!("reservation" in r.json), `${label}: booking details leaked`);
  const text = JSON.stringify(r.json);
  for (const v of [RESERVATION.guest_name, RESERVATION.guest_email, RESERVATION.date]) {
    assert(!text.includes(v), `${label}: response contains booking detail "${v}"`);
  }
}

function assertUntouched(seen: Seen[], label: string) {
  const past = seen.filter((s) => s.table !== "booking_tokens");
  assert(past.length === 0, `${label}: went past the link check: ${JSON.stringify(past)}`);
  const writes = seen.filter((s) => s.method !== "GET" && s.method !== "HEAD");
  assert(writes.length === 0, `${label}: something was written: ${JSON.stringify(writes)}`);
}

const opts = { sanitizeOps: false, sanitizeResources: false };

for (const [name, when] of [
  ["1 second ago", ago(1_000)],
  ["1 day ago", ago(86_400_000)],
  ["1 year ago", ago(365 * 86_400_000)],
] as const) {
  Deno.test({
    ...opts,
    name: `expired ${name}: view, reschedule and cancel are refused with no details and no changes`,
    fn: async () => {
      const b = installBackend(when);
      try {
        for (const a of ACTIONS) await expectRefused(a, `${name} ${a.action}`);
        assertUntouched(b.seen, name);
      } finally {
        b.restore();
      }
    },
  });
}

Deno.test({
  ...opts,
  name: "expired: a link that worked is refused once it expires, including the same request again",
  fn: async () => {
    const b = installBackend(() => new Date(Date.now() + 60_000).toISOString());
    try {
      const first = await send(VIEW);
      assert(first.json.ok === true && first.json.reservation?.id === RESERVATION.id, "control: valid link should open");
      b.state.expiresAt = ago(1_000);
      b.seen.length = 0;
      for (const a of ACTIONS) await expectRefused(a, `after expiry ${a.action}`);
      await expectRefused(VIEW, "view replayed after expiry");
      assertUntouched(b.seen, "after expiry");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "expired: replaying 3 rounds and 9 simultaneous requests are all refused",
  fn: async () => {
    const b = installBackend(ago(60_000));
    try {
      for (let round = 1; round <= 3; round++) {
        for (const a of ACTIONS) await expectRefused(a, `round ${round} ${a.action}`);
      }
      await Promise.all(Array.from({ length: 9 }, (_, i) => expectRefused(ACTIONS[i % 3], `parallel ${i}`)));
      assertUntouched(b.seen, "replay");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "expired: extra fields (another booking's id, a new expiry date) do not get the link through",
  fn: async () => {
    const b = installBackend(ago(60_000));
    try {
      const extras = [
        { reservation_id: OTHER_RESERVATION_ID },
        { expires_at: new Date(Date.now() + 86_400_000).toISOString() },
        { guest_email: RESERVATION.guest_email },
      ];
      for (const extra of extras) {
        for (const a of ACTIONS) await expectRefused({ ...a, ...extra }, `${a.action} + ${JSON.stringify(extra)}`);
      }
      assertUntouched(b.seen, "extra fields");
      assert(!b.seen.some((s) => s.query.includes(OTHER_RESERVATION_ID)), "another booking was looked up");
    } finally {
      b.restore();
    }
  },
});
