// Unit tests for the integration-test cleanup check, using a pretend store.
import { deleteAndVerifyLinks, type CleanupClient } from "./test-link-cleanup.ts";

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }
const TOKENS = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];

function store(o: { stuckDeletes?: number; deleteError?: boolean; readError?: boolean; neverDelete?: boolean } = {}) {
  const rows = new Set(TOKENS);
  let deletes = 0;
  const client: CleanupClient = {
    from: () => ({
      delete: () => ({
        in: (_c, v) => {
          deletes++;
          if (o.deleteError) return Promise.resolve({ error: { message: "boom" } });
          if (!o.neverDelete && deletes > (o.stuckDeletes ?? 0)) v.forEach((t) => rows.delete(t));
          return Promise.resolve({ error: null });
        },
      }),
      select: () => ({
        in: (_c, v) =>
          Promise.resolve(o.readError
            ? { data: null, error: { message: "read boom" } }
            : { data: v.filter((t) => rows.has(t)).map((t) => ({ id: t })), error: null }),
      }),
    }),
  };
  return { client, rows, deletes: () => deletes };
}
const quiet = { log: () => {}, wait: () => Promise.resolve() };
async function throws(p: Promise<unknown>) { try { await p; } catch (e) { return String(e); } return null; }

Deno.test("cleanup: all three links deleted and confirmed", async () => {
  const s = store(); const logs: string[] = [];
  await deleteAndVerifyLinks(s.client, TOKENS, { ...quiet, log: (m) => logs.push(m) });
  assert(s.rows.size === 0 && logs[0].includes("all 3"), JSON.stringify(logs));
});
Deno.test("cleanup: retries when a delete does not take effect the first time", async () => {
  const s = store({ stuckDeletes: 1 });
  await deleteAndVerifyLinks(s.client, TOKENS, quiet);
  assert(s.rows.size === 0 && s.deletes() === 2, `deletes=${s.deletes()}`);
});
Deno.test("cleanup: fails when links remain after every attempt, without printing link codes", async () => {
  const s = store({ neverDelete: true });
  const err = await throws(deleteAndVerifyLinks(s.client, TOKENS, quiet));
  assert(err?.includes("3 of 3 throwaway links still stored"), String(err));
  assert(!TOKENS.some((t) => err!.includes(t.slice(0, 8))), "link code printed");
});
Deno.test("cleanup: a delete error with links left fails", async () => {
  const err = await throws(deleteAndVerifyLinks(store({ deleteError: true }).client, TOKENS, quiet));
  assert(err?.includes("still stored") && err.includes("delete failed"), String(err));
});
Deno.test("cleanup: an unreadable result fails closed", async () => {
  const err = await throws(deleteAndVerifyLinks(store({ readError: true }).client, TOKENS, quiet));
  assert(err?.includes("could not confirm"), String(err));
});
Deno.test("cleanup: runs from finally after a failed step", async () => {
  const s = store();
  const err = await throws((async () => {
    try { throw new Error("step failed"); } finally { await deleteAndVerifyLinks(s.client, TOKENS, quiet); }
  })());
  assert(err?.includes("step failed") && s.rows.size === 0, String(err));
});
