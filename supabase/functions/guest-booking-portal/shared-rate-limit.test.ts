// The guest-link limit is counted in the database (shared by every running
// copy of the function), keyed by a hash of the caller address, and fails
// closed when the count can't be read.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callerAddress, checkRateLimit, LIVE_RATE_LIMIT_MAX } from "./index.ts";

type Call = { fn: string; args: Record<string, unknown> };

// Simulates the database function: one shared count per bucket key.
function fakeDb() {
  const counts = new Map<string, number>();
  const calls: Call[] = [];
  return {
    calls,
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      const key = String(args._bucket_key);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return Promise.resolve({ data: n <= Number(args._max), error: null });
    },
  };
}

Deno.test("two separate copies share one count: 6th request is refused", async () => {
  const db = fakeDb();
  const results: boolean[] = [];
  for (let i = 0; i < 6; i++) results.push(await checkRateLimit(db, "203.0.113.7"));
  assertEquals(results, [true, true, true, true, true, false]);
  assertEquals(LIVE_RATE_LIMIT_MAX, 5);
  assertEquals(db.calls[0].args._max, 5);
  assertEquals(db.calls[0].args._window_seconds, 60);
});

Deno.test("different people have separate counts", async () => {
  const db = fakeDb();
  for (let i = 0; i < 5; i++) await checkRateLimit(db, "203.0.113.7");
  assert(await checkRateLimit(db, "198.51.100.2"));
});

Deno.test("raw address is never sent, only a hash", async () => {
  const db = fakeDb();
  await checkRateLimit(db, "203.0.113.7");
  const key = String(db.calls[0].args._bucket_key);
  assert(/^[0-9a-f]{64}$/.test(key));
  assert(!JSON.stringify(db.calls).includes("203.0.113.7"));
});

Deno.test("fails closed on database error or crash", async () => {
  const errDb = { rpc: () => Promise.resolve({ data: null, error: { code: "XX000" } }) };
  assertEquals(await checkRateLimit(errDb, "203.0.113.7"), false);
  const crashDb = { rpc: () => Promise.reject(new Error("down")) };
  assertEquals(await checkRateLimit(crashDb, "203.0.113.7"), false);
  const oddDb = { rpc: () => Promise.resolve({ data: "yes", error: null }) };
  assertEquals(await checkRateLimit(oddDb, "203.0.113.7"), false);
});

Deno.test("caller address: forwarded header first, then cf-connecting-ip", () => {
  assertEquals(callerAddress(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  assertEquals(callerAddress(new Headers({ "cf-connecting-ip": "9.9.9.9" })), "9.9.9.9");
  assertEquals(callerAddress(new Headers()), "unknown");
});
