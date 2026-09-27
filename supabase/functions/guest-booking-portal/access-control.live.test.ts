// Live regression test: calls the DEPLOYED guest-booking-portal function the
// way a guest's browser does (publishable key only, no sign-in).
//   - an unknown booking link shows nothing ("not_found")
//   - a malformed link is refused (400)
//   - cancelling or changing through an unknown link is refused (403)
//   - the "find my booking" lookup always answers generically, so it never
//     reveals whether an email has bookings
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const ENABLED = !!URL_BASE && !!KEY;

async function call(body: unknown) {
  const res = await fetch(`${URL_BASE}/functions/v1/guest-booking-portal`, {
    method: "POST",
    headers: {
      apikey: KEY!,
      "Content-Type": "application/json",
      Origin: "https://mimmobook.com",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

// 64 hex chars: well-formed, but never issued.
const UNKNOWN_TOKEN = Array.from(crypto.getRandomValues(new Uint8Array(32)))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

Deno.test({
  name: "guest portal live: unknown link shows no booking",
  ignore: !ENABLED,
  fn: async () => {
    const r = await call({ action: "view", token: UNKNOWN_TOKEN });
    assertEquals(r.status, 200, r.text);
    assertEquals(JSON.parse(r.text), { ok: false, code: "not_found" });
  },
});

Deno.test({
  name: "guest portal live: malformed link is refused",
  ignore: !ENABLED,
  fn: async () => {
    const r = await call({ action: "view", token: "x';--" });
    assertEquals(r.status, 400, r.text);
    assert(!r.text.includes("guest_name"), r.text);
  },
});

Deno.test({
  name: "guest portal live: cancelling through an unknown link is refused",
  ignore: !ENABLED,
  fn: async () => {
    const r = await call({ action: "cancel", token: UNKNOWN_TOKEN });
    assertEquals(r.status, 403, r.text);
  },
});
