// Monitoring of guest link limit refusals and database errors.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkRateLimit, recordLimitEvent } from "./index.ts";

type Call = { fn: string; args: Record<string, unknown> };

function db(consume: () => Promise<{ data: unknown; error: unknown }>, monitorFails = false) {
  const calls: Call[] = [];
  return {
    calls,
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      if (fn === "record_guest_portal_limit_event") {
        return Promise.resolve({ data: null, error: monitorFails ? { code: "XX000" } : null });
      }
      return consume();
    },
  };
}
const events = (d: { calls: Call[] }) =>
  d.calls.filter((c) => c.fn === "record_guest_portal_limit_event").map((c) => c.args._kind);

const quiet = () => {
  const w = console.warn, e = console.error;
  console.warn = () => {};
  console.error = () => {};
  return () => { console.warn = w; console.error = e; };
};

Deno.test("allowed request records nothing", async () => {
  const d = db(() => Promise.resolve({ data: true, error: null }));
  assert(await checkRateLimit(d, "203.0.113.7"));
  assertEquals(events(d), []);
});

Deno.test("refused request records 'refused'", async () => {
  const r = quiet();
  const d = db(() => Promise.resolve({ data: false, error: null }));
  assertEquals(await checkRateLimit(d, "203.0.113.7"), false);
  r();
  assertEquals(events(d), ["refused"]);
});

Deno.test("database error and crash record 'db_error' and still refuse", async () => {
  const r = quiet();
  const a = db(() => Promise.resolve({ data: null, error: { code: "XX000" } }));
  const b = db(() => Promise.reject(new Error("down")));
  assertEquals(await checkRateLimit(a, "203.0.113.7"), false);
  assertEquals(await checkRateLimit(b, "203.0.113.7"), false);
  r();
  assertEquals(events(a), ["db_error"]);
  assertEquals(events(b), ["db_error"]);
});

Deno.test("monitor record never holds the caller address", async () => {
  const r = quiet();
  const d = db(() => Promise.resolve({ data: false, error: null }));
  await checkRateLimit(d, "203.0.113.7");
  r();
  const rec = d.calls.find((c) => c.fn === "record_guest_portal_limit_event")!;
  assertEquals(Object.keys(rec.args), ["_kind"]);
  assert(!JSON.stringify(d.calls).includes("203.0.113.7"));
});

Deno.test("failed monitor write never throws and logs a fixed tag", async () => {
  const logs: string[] = [];
  const w = console.warn, e = console.error;
  console.warn = (...a: unknown[]) => logs.push(a.join(" "));
  console.error = (...a: unknown[]) => logs.push(a.join(" "));
  try {
    await recordLimitEvent(db(() => Promise.resolve({ data: true, error: null }), true), "db_error");
    await recordLimitEvent({ rpc: () => Promise.reject(new Error("down")) }, "refused");
  } finally {
    console.warn = w; console.error = e;
  }
  assert(logs.some((l) => l.includes("[GUEST-PORTAL-LIMIT] db_error")));
  assert(logs.some((l) => l.includes("monitor write failed")));
});
