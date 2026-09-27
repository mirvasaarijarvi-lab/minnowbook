// Regression tests: revoking one guest booking link must leave every other
// booking's link working. The backend is a small in-memory database behind a
// stubbed fetch that applies the real eq-filters the portal sends, so a
// revoke or cancel that matched too many rows would show up here.
import { handleGuestBookingPortalRequest } from "./index.ts";

const TENANT = "44444444-4444-4444-8444-444444444444";
const OTHER_TENANT = "66666666-6666-4666-8666-666666666666";

// Link codes are 64 characters. B differs from A only in its last
// character, so a prefix or loose match would catch both.
const LINK = {
  a: "a".repeat(64),
  b: "a".repeat(63) + "b",
  sameGuest: "d".repeat(64),
  otherTenant: "e".repeat(64),
};
const BOOKING = {
  a: "11111111-1111-4111-8111-111111111111",
  b: "22222222-2222-4222-8222-222222222222",
  sameGuest: "33333333-3333-4333-8333-333333333333",
  otherTenant: "55555555-5555-4555-8555-555555555555",
};
type Key = keyof typeof LINK;
const KEYS: Key[] = ["a", "b", "sameGuest", "otherTenant"];
const OTHERS: Key[] = ["b", "sameGuest", "otherTenant"];

type Row = Record<string, unknown>;
type Seen = { method: string; table: string; params: URLSearchParams; body: Row | null };

function freshDb() {
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const tenantOf = (k: Key) => (k === "otherTenant" ? OTHER_TENANT : TENANT);
  return {
    booking_tokens: KEYS.map((k) => ({
      token: LINK[k],
      reservation_id: BOOKING[k],
      tenant_id: tenantOf(k),
      is_revoked: false,
      expires_at: future,
    })),
    reservations: KEYS.map((k) => ({
      id: BOOKING[k],
      tenant_id: tenantOf(k),
      status: "confirmed",
      reservation_type: "custom",
      date: "2099-01-01",
      start_time: "18:00:00",
      guest_name: k === "sameGuest" ? "Guest A" : `Guest ${k}`,
      // Booking "sameGuest" belongs to the same person as booking "a".
      guest_email: k === "sameGuest" || k === "a" ? "a@example.test" : `${k}@example.test`,
      internal_notes: null,
    })),
    reschedule_requests: [] as Row[],
    notifications: [] as Row[],
  } as Record<string, Row[]>;
}

/** Rows matching every `col=eq.value` filter in the query. */
function matching(rows: Row[], params: URLSearchParams) {
  const filters = [...params.entries()].filter(([, v]) => v.startsWith("eq."));
  return rows.filter((r) => filters.every(([c, v]) => String(r[c]) === v.slice(3)));
}

function installBackend() {
  const db = freshDb();
  const seen: Seen[] = [];
  const realFetch = globalThis.fetch;
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key");
  let nextId = 1;

  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const table = url.pathname.split("/").pop() ?? "";
    const text = req.method === "GET" ? "" : await req.text();
    const body = text ? JSON.parse(text) : null;
    seen.push({ method: req.method, table, params: url.searchParams, body });
    const reply = (data: unknown, status = 200) =>
      new Response(data === null ? "" : JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      });
    const rows = db[table];
    if (!rows) return req.method === "GET" ? reply(null, 406) : reply([]);
    if (req.method === "GET") {
      const hit = matching(rows, url.searchParams)[0];
      return hit ? reply({ ...hit }) : reply(null, 406);
    }
    if (req.method === "PATCH") {
      const hits = matching(rows, url.searchParams);
      hits.forEach((r) => Object.assign(r, body));
      return reply(hits);
    }
    if (req.method === "POST") {
      const row = { id: `row-${nextId++}`, status: "pending", ...(Array.isArray(body) ? body[0] : body) };
      rows.push(row);
      return reply(row, 201);
    }
    return reply([]);
  }) as typeof fetch;

  return {
    db,
    seen,
    token: (k: Key) => db.booking_tokens.find((t) => t.token === LINK[k])!,
    booking: (k: Key) => db.reservations.find((r) => r.id === BOOKING[k])!,
    /** Staff revoking one link, as the database would: exactly that row. */
    revoke: (k: Key) => {
      db.booking_tokens.find((t) => t.token === LINK[k])!.is_revoked = true;
    },
    restore: () => {
      globalThis.fetch = realFetch;
      prevUrl === undefined ? Deno.env.delete("SUPABASE_URL") : Deno.env.set("SUPABASE_URL", prevUrl);
      prevKey === undefined
        ? Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY")
        : Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
    },
  };
}
type Backend = ReturnType<typeof installBackend>;

let ipCounter = 0;
async function send(k: Key, body: Record<string, unknown>) {
  const res = await handleGuestBookingPortalRequest(
    new Request("https://example.test/guest-booking-portal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://mimmobook.com",
        "x-forwarded-for": `10.3.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`,
      },
      body: JSON.stringify({ token: LINK[k], ...body }),
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

async function expectWorks(b: Backend, k: Key) {
  const v = await send(k, VIEW);
  assert(v.json.ok === true && v.json.reservation?.id === BOOKING[k], `${k} view: ${JSON.stringify(v.json)}`);
  const r = await send(k, RESCHEDULE);
  assert(r.status === 200 && r.json.ok === true, `${k} reschedule: ${r.status} ${JSON.stringify(r.json)}`);
  assert(
    b.db.reschedule_requests.some((q) => q.reservation_id === BOOKING[k]),
    `${k} reschedule request was not saved for its own booking`,
  );
  const c = await send(k, CANCEL);
  assert(c.status === 200 && c.json.ok === true, `${k} cancel: ${c.status} ${JSON.stringify(c.json)}`);
  assert(b.booking(k).status === "cancelled", `${k} booking was not cancelled`);
}

async function expectRefused(k: Key, label: string) {
  const v = await send(k, VIEW);
  assert(v.json.ok === false && v.json.code === "revoked", `${label} view: ${JSON.stringify(v.json)}`);
  for (const body of [RESCHEDULE, CANCEL]) {
    const r = await send(k, body);
    assert(r.status === 403, `${label} ${body.action}: ${r.status} ${JSON.stringify(r.json)}`);
  }
}

/** Every write to links or bookings was aimed at exactly the allowed ones. */
function assertWritesOnlyTouched(b: Backend, allowed: Key[], label: string) {
  for (const s of b.seen.filter((x) => x.method === "PATCH")) {
    if (s.table === "booking_tokens") {
      const target = s.params.get("token");
      assert(
        allowed.some((k) => target === `eq.${LINK[k]}`),
        `${label}: a link update was not limited to the allowed link (filter ${target})`,
      );
    }
    if (s.table === "reservations") {
      const target = s.params.get("id");
      assert(
        allowed.some((k) => target === `eq.${BOOKING[k]}`),
        `${label}: a booking update was not limited to the allowed booking (filter ${target})`,
      );
    }
  }
}

const opts = { sanitizeOps: false, sanitizeResources: false };

Deno.test({
  ...opts,
  name: "isolation: after staff revoke link A, links for another booking, the same guest's other booking and another business all still work",
  fn: async () => {
    const b = installBackend();
    try {
      b.revoke("a");
      await expectRefused("a", "revoked A");
      for (const k of OTHERS) {
        await expectWorks(b, k);
        assert(b.token(k).is_revoked === false || b.booking(k).status === "cancelled", `${k} link changed`);
      }
      assert(b.booking("a").status === "confirmed", "booking A itself should be left as it was");
      assertWritesOnlyTouched(b, OTHERS, "staff revoke");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "isolation: a guest cancelling through link A revokes only link A; every other link stays valid and its booking unchanged",
  fn: async () => {
    const b = installBackend();
    try {
      const c = await send("a", CANCEL);
      assert(c.status === 200 && c.json.ok === true, `cancel A: ${c.status} ${JSON.stringify(c.json)}`);
      assert(b.token("a").is_revoked === true, "link A should be revoked by the cancel");
      for (const k of OTHERS) {
        assert(b.token(k).is_revoked === false, `link ${k} was revoked by cancelling A`);
        assert(b.booking(k).status === "confirmed", `booking ${k} was changed by cancelling A`);
      }
      assertWritesOnlyTouched(b, ["a"], "cancel through A");
      await expectRefused("a", "A after its cancel");
      for (const k of OTHERS) {
        const v = await send(k, VIEW);
        assert(v.json.ok === true && v.json.reservation?.id === BOOKING[k], `${k} view after A cancelled`);
      }
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "isolation: a link differing from the revoked one by a single character keeps working",
  fn: async () => {
    const b = installBackend();
    try {
      b.revoke("a");
      const v = await send("b", VIEW);
      assert(v.json.ok === true && v.json.reservation?.id === BOOKING.b, `near-identical link B: ${JSON.stringify(v.json)}`);
      await expectRefused("a", "revoked A");
      // And the reverse: revoking B leaves A's neighbour untouched.
      const b2 = installBackend();
      try {
        b2.revoke("b");
        const va = await send("a", VIEW);
        assert(va.json.ok === true && va.json.reservation?.id === BOOKING.a, "A after revoking B");
      } finally {
        b2.restore();
      }
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "isolation: 16 simultaneous requests mixing revoked link A with valid links: A all refused, the others all served",
  fn: async () => {
    const b = installBackend();
    try {
      b.revoke("a");
      const order: Key[] = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? "a" : OTHERS[i % 3]));
      const results = await Promise.all(order.map((k) => send(k, VIEW)));
      results.forEach((r, i) => {
        const k = order[i];
        if (k === "a") assert(r.json.code === "revoked" && !("reservation" in r.json), `parallel ${i} A: ${JSON.stringify(r.json)}`);
        else assert(r.json.ok === true && r.json.reservation?.id === BOOKING[k], `parallel ${i} ${k}: ${JSON.stringify(r.json)}`);
      });
      assert(b.seen.every((s) => s.method === "GET"), "viewing should never write anything");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "isolation: revoked link A sent with another booking's id or business cannot reach or change that booking",
  fn: async () => {
    const b = installBackend();
    try {
      b.revoke("a");
      for (const k of OTHERS) {
        const extra = { reservation_id: BOOKING[k], tenant_id: b.booking(k).tenant_id };
        const v = await send("a", { ...VIEW, ...extra });
        assert(v.json.code === "revoked" && !("reservation" in v.json), `A + ${k} id view: ${JSON.stringify(v.json)}`);
        for (const body of [RESCHEDULE, CANCEL]) {
          const r = await send("a", { ...body, ...extra });
          assert(r.status === 403, `A + ${k} id ${body.action}: ${r.status}`);
        }
        assert(b.booking(k).status === "confirmed" && b.token(k).is_revoked === false, `${k} was changed`);
      }
      const lookedUp = b.seen.filter((s) => s.table === "reservations");
      assert(lookedUp.length === 0, "a booking was looked up through a revoked link");
      assert(b.seen.every((s) => s.method === "GET"), "something was written through a revoked link");
    } finally {
      b.restore();
    }
  },
});

Deno.test({
  ...opts,
  name: "isolation: revoking every other link one by one never affects the last remaining one",
  fn: async () => {
    const b = installBackend();
    try {
      const survivor: Key = "sameGuest";
      for (const k of KEYS.filter((x) => x !== survivor)) {
        b.revoke(k);
        const v = await send(survivor, VIEW);
        assert(v.json.ok === true && v.json.reservation?.id === BOOKING[survivor], `survivor after revoking ${k}`);
        await expectRefused(k, `revoked ${k}`);
      }
      await expectWorks(b, survivor);
    } finally {
      b.restore();
    }
  },
});
