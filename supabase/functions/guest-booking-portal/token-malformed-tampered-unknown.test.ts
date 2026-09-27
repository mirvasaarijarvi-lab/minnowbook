// Regression tests: malformed, tampered and unknown guest booking links must
// never show, change or cancel a booking. The backend is a stubbed fetch that
// only knows one stored link, so any other link value finds nothing.
import { handleGuestBookingPortalRequest } from "./index.ts";

const STORED = "Ab3_xY9-" + "k".repeat(56);
const RESERVATION = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  status: "confirmed",
  date: "2099-01-01",
  start_time: "18:00:00",
  guest_name: "Test Guest",
  guest_email: "guest@example.test",
};
type Seen = { method: string; table: string; query: string };
let ip = 0;

async function call(token: unknown, body: Record<string, unknown>) {
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
    const query = decodeURIComponent(url.search);
    seen.push({ method: req.method, table, query });
    const reply = (data: unknown) =>
      Promise.resolve(
        new Response(data === null ? "" : JSON.stringify(data), {
          status: data === null ? 406 : 200,
          headers: { "content-type": "application/json" },
        }),
      );
    if (req.method === "GET" && table === "booking_tokens") {
      // Exact match only, like the real database.
      return reply(
        url.searchParams.get("token") === `eq.${STORED}`
          ? { reservation_id: RESERVATION.id, tenant_id: RESERVATION.tenant_id, is_revoked: false, expires_at: new Date(Date.now() + 86_400_000).toISOString() }
          : null,
      );
    }
    if (req.method === "GET" && table === "reservations") return reply(RESERVATION);
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
          "x-forwarded-for": `10.1.0.${++ip}`,
        },
        body: JSON.stringify({ token, ...body }),
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
const onlyTokenLookup = (seen: Seen[], label: string) => {
  const other = seen.filter((s) => s.table !== "booking_tokens");
  assert(other.length === 0, `${label}: went past the link check: ${JSON.stringify(other)}`);
};

const ACTIONS: Array<[string, Record<string, unknown>]> = [
  ["view", { action: "view", reservation_id: RESERVATION.id }],
  ["reschedule", { action: "reschedule", reservation_id: RESERVATION.id, requested_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) }],
  ["cancel", { action: "cancel", reservation_id: RESERVATION.id, language: "en" }],
];

Deno.test("control: the stored link shows its booking", async () => {
  const r = await call(STORED, { action: "view" });
  assert(r.status === 200 && r.json.reservation?.id === RESERVATION.id, JSON.stringify(r.json));
});

const MALFORMED: Array<[string, unknown]> = [
  ["missing", undefined],
  ["null", null],
  ["number", 12345678901234567890],
  ["object", { $ne: "" }],
  ["array", [STORED]],
  ["empty", ""],
  ["too short", "a".repeat(15)],
  ["too long", "a".repeat(129)],
  ["SQL-like", "' OR '1'='1' --xxxxxxxx"],
  ["filter wildcard", "%".repeat(20)],
  ["filter injection", `${STORED},token.neq.x`],
  ["spaces inside", "abcd efgh ijkl mnop"],
  ["unicode", "ä".repeat(20)],
  ["newline inside", `${STORED.slice(0, 20)}\n${STORED.slice(20)}`],
];

for (const [name, token] of MALFORMED) {
  for (const [action, body] of ACTIONS) {
    Deno.test(`malformed (${name}) link: ${action} is refused before any lookup`, async () => {
      const r = await call(token, body);
      assert(r.status === 400, `expected 400, got ${r.status} ${JSON.stringify(r.json)}`);
      assert(!("reservation" in r.json), "malformed link leaked booking data");
      assert(r.seen.length === 0, `backend was contacted: ${JSON.stringify(r.seen)}`);
    });
  }
}

const TAMPERED: Array<[string, string]> = [
  ["last character changed", STORED.slice(0, -1) + "j"],
  ["first character changed", "B" + STORED.slice(1)],
  ["case changed", STORED.toUpperCase()],
  ["one character dropped", STORED.slice(0, -1)],
  ["one character added", STORED + "k"],
  ["prefix only", STORED.slice(0, 32)],
];

for (const [name, token] of TAMPERED) {
  for (const [action, body] of ACTIONS) {
    Deno.test(`tampered (${name}) link: ${action} is refused`, async () => {
      const r = await call(token, body);
      assert(r.json.ok !== true, `tampered link accepted: ${JSON.stringify(r.json)}`);
      assert(!("reservation" in r.json), "tampered link leaked booking data");
      if (action !== "view") assert(r.status === 403 || r.status === 404, `expected refusal, got ${r.status}`);
      onlyTokenLookup(r.seen, `${name} ${action}`);
      const q = r.seen.find((s) => s.table === "booking_tokens")?.query ?? "";
      assert(q.includes(`token=eq.${token}`), `lookup did not use the exact link: ${q}`);
    });
  }
}

Deno.test("unknown link: view says not found and ignores the booking number", async () => {
  const r = await call("u".repeat(64), { action: "view", reservation_id: RESERVATION.id });
  assert(r.json.ok === false && r.json.code === "not_found", JSON.stringify(r.json));
  onlyTokenLookup(r.seen, "unknown view");
});

for (const [action, body] of ACTIONS.slice(1)) {
  Deno.test(`unknown link: ${action} is refused and nothing is written`, async () => {
    const r = await call("u".repeat(64), body);
    assert(r.status === 403 || r.status === 404, `expected refusal, got ${r.status}`);
    assert(!r.seen.some((s) => s.method !== "GET"), `write attempted: ${JSON.stringify(r.seen)}`);
    onlyTokenLookup(r.seen, `unknown ${action}`);
  });
}

Deno.test("surrounding spaces are trimmed, not treated as a new link", async () => {
  const r = await call(`  ${STORED}  `, { action: "view" });
  assert(r.status === 200 && r.json.reservation?.id === RESERVATION.id, JSON.stringify(r.json));
});
