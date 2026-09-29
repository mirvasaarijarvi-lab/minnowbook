import "./test-rate-limit-stub.ts";
// Regression tests for three security fixes:
//   1. guest-booking-portal "lookup" matches the typed email exactly: LIKE
//      wildcards (% _ \) are escaped, so one lookup can never reach other
//      guests' bookings.
//   2. public-booking retry de-duplication answers "already received" without
//      echoing the existing booking's references.
//   3. reschedule-review keeps the staff note internal and never puts it in
//      the guest email.
import { handleGuestBookingPortalRequest } from "../guest-booking-portal/index.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const here = new URL(".", import.meta.url);
const read = (p: string) => Deno.readTextFile(new URL(p, here));

// ---------- 1. Lookup email is matched exactly ----------

function installLookupBackend() {
  const reservationQueries: string[] = [];
  const realFetch = globalThis.fetch;
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key");
  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const table = url.pathname.split("/").pop() ?? "";
    if (req.method === "GET" && table === "reservations") {
      reservationQueries.push(decodeURIComponent(url.search));
    }
    const body = req.method === "GET" ? "[]" : "{}";
    return Promise.resolve(
      new Response(body, { status: 200, headers: { "content-type": "application/json" } }),
    );
  }) as typeof fetch;
  return {
    reservationQueries,
    restore() {
      globalThis.fetch = realFetch;
      prevUrl === undefined ? Deno.env.delete("SUPABASE_URL") : Deno.env.set("SUPABASE_URL", prevUrl);
      prevKey === undefined
        ? Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY")
        : Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
    },
  };
}

let ip = 0;
async function lookup(email: string) {
  const res = await handleGuestBookingPortalRequest(
    new Request("https://example.test/guest-booking-portal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://mimmobook.com",
        "x-forwarded-for": `10.9.${Math.floor(++ip / 250)}.${ip % 250}`,
      },
      body: JSON.stringify({ action: "lookup", email, language: "en" }),
    }),
  );
  await res.body?.cancel();
  return res.status;
}

function guestEmailFilter(query: string): string {
  const m = query.match(/guest_email=([^&]*)/);
  assert(m, `reservations query has no guest_email filter: ${query}`);
  return m[1];
}

for (const [email, expected] of [
  ["guest@example.test", "ilike.guest@example.test"],
  ["a_b@example.test", "ilike.a\\_b@example.test"],
  ["a%b@example.test", "ilike.a\\%b@example.test"],
] as const) {
  Deno.test({
    name: `lookup: email ${JSON.stringify(email)} is matched exactly, wildcards escaped`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
      const b = installLookupBackend();
      try {
        await lookup(email);
        if (b.reservationQueries.length === 0) return; // rejected before querying: also safe
        for (const q of b.reservationQueries) {
          assert(guestEmailFilter(q) === expected, `expected ${expected}, got ${guestEmailFilter(q)}`);
        }
      } finally {
        b.restore();
      }
    },
  });
}

Deno.test({
  name: "lookup: no unescaped wildcard ever reaches the email filter",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const b = installLookupBackend();
    try {
      for (const email of ["%@example.test", "_@example.test", "%_%@x.test", "a\\%@x.test"]) {
        await lookup(email);
      }
      for (const q of b.reservationQueries) {
        const value = guestEmailFilter(q).replace(/^ilike\./, "");
        // Every % or _ must be preceded by an escaping backslash.
        const stripped = value.replace(/\\[\\%_]/g, "");
        assert(!/[%_]/.test(stripped), `unescaped wildcard in ${value}`);
      }
    } finally {
      b.restore();
    }
  },
});

// ---------- 2. Duplicate reply hides existing booking references ----------

Deno.test("public-booking: duplicate reply never echoes the existing booking", async () => {
  const src = await read("../public-booking/index.ts");
  const start = src.indexOf("---------- Retry de-duplication ----------");
  assert(start > 0, "retry de-duplication block not found");
  const block = src.slice(start, src.indexOf("return new Response(", start) + 1200);
  const reply = block.slice(block.indexOf("return new Response("));
  const payload = reply.slice(0, reply.indexOf("}),") + 3);
  assert(/duplicate:\s*true/.test(payload), "duplicate flag missing");
  assert(/reservation:\s*null/.test(payload), "reservation must be null in the duplicate reply");
  assert(/linked_group_id:\s*null/.test(payload), "linked_group_id must be null");
  assert(/linked_siblings:\s*\[\]/.test(payload), "linked_siblings must be empty");
  assert(!/existing\.(id|linked_group_id)/.test(payload), "existing booking reference leaked");
});

// ---------- 3. Staff note never reaches the guest email ----------

Deno.test("reschedule-review: staff note is saved but never put in the guest email", async () => {
  const src = await read("../reschedule-review/index.ts");
  assert(/const guestNote: string \| null = null;/.test(src), "guestNote must be fixed to null");
  assert(/staff_note:\s*staffNote/.test(src), "staff note must still be saved on the request");
  const emailStart = src.indexOf('rpc("enqueue_email"');
  assert(emailStart > 0, "email enqueue not found");
  const htmlStart = src.lastIndexOf("<p", src.indexOf("noteLabel"));
  const emailArea = src.slice(Math.min(emailStart, htmlStart));
  assert(!/staffNote|staff_note|body\.staff_note/.test(emailArea), "staff note used in guest email");
});
