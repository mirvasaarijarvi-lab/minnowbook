// Unit tests for the leftover-test-link recovery, using a pretend store.
import {
  DEFAULT_TEST_TENANT_ID as T,
  isTestToken,
  newTestToken,
  recoverStaleTestLinks,
  type RecoveryClient,
  TEST_LINK_PREFIX,
} from "./test-link-recovery.ts";

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }
const NOW = Date.parse("2026-09-27T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const OTHER = "11111111-1111-1111-1111-111111111111";
type Row = { id: string; token: string; tenant_id: string; created_at: string };

// Pretend store that applies the filters like the database would ("%"-suffix LIKE only).
function store(rows: Row[], o: { deleteError?: boolean; readError?: boolean; neverDelete?: boolean; lieInLookup?: Row[] } = {}) {
  const db = new Map(rows.map((r) => [r.id, r]));
  const deletedIds: string[] = [];
  const like = (t: string, p: string) => t.startsWith(p.replace(/%$/, ""));
  const client: RecoveryClient = {
    from: () => ({
      select: () => ({
        eq: (_c, tenant) => ({
          like: (_c2, p) => ({
            lt: (_c3, cut) => {
              if (o.readError) return Promise.resolve({ data: null, error: { message: "read boom" } });
              const hit = [...db.values()].filter((r) => r.tenant_id === tenant && like(r.token, p) && r.created_at < cut);
              return Promise.resolve({ data: [...hit, ...(o.lieInLookup ?? [])], error: null });
            },
          }),
        }),
      }),
      delete: () => ({
        in: (_c, ids) => ({
          eq: (_c2, tenant) => ({
            like: (_c3, p) => {
              if (o.deleteError) return Promise.resolve({ data: null, error: { message: "boom" } });
              for (const id of ids) {
                const r = db.get(id);
                if (r && r.tenant_id === tenant && like(r.token, p) && !o.neverDelete) { db.delete(id); deletedIds.push(id); }
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
        }),
      }),
    }),
  };
  return { client, db, deletedIds };
}
const quiet = { log: () => {} };
async function throws(p: Promise<unknown>) { try { await p; } catch (e) { return String(e); } return null; }

const oldTest = (id: string) => ({ id, token: newTestToken(), tenant_id: T, created_at: ago(60) });
const realLink = { id: "real", token: "f".repeat(64), tenant_id: T, created_at: ago(600) };

Deno.test("recovery: test link codes carry the marker and pass the portal's format", () => {
  const t = newTestToken();
  assert(isTestToken(t) && /^[A-Za-z0-9_-]{16,128}$/.test(t), t.length.toString());
  assert(!TEST_LINK_PREFIX.includes("_") && !TEST_LINK_PREFIX.includes("%"), "prefix must not hold LIKE wildcards");
  assert(!isTestToken("f".repeat(64)) && !isTestToken(TEST_LINK_PREFIX + "zz"), "real/odd codes not test links");
});

Deno.test("recovery: removes old leftover test links and confirms they are gone", async () => {
  const s = store([oldTest("a"), oldTest("b"), oldTest("c")]); const logs: string[] = [];
  const r = await recoverStaleTestLinks(s.client, { tenantId: T, now: NOW, log: (m) => logs.push(m) });
  assert(r.deleted === 3 && s.db.size === 0, JSON.stringify(r));
  assert(logs[0].includes("removed 3") && !logs[0].includes(TEST_LINK_PREFIX), logs[0]);
});

Deno.test("recovery: never touches real links, recent test links, or other businesses", async () => {
  const recent = { id: "recent", token: newTestToken(), tenant_id: T, created_at: ago(2) };
  const otherBiz = { id: "other", token: newTestToken(), tenant_id: OTHER, created_at: ago(60) };
  const lookalike = { id: "look", token: TEST_LINK_PREFIX + "x".repeat(64), tenant_id: T, created_at: ago(60) };
  const s = store([realLink, recent, otherBiz, lookalike, oldTest("old")]);
  const r = await recoverStaleTestLinks(s.client, { tenantId: T, now: NOW, ...quiet });
  assert(JSON.stringify(s.deletedIds) === '["old"]', JSON.stringify(s.deletedIds));
  assert(r.skipped === 1 && ["real", "recent", "other", "look"].every((id) => s.db.has(id)), JSON.stringify(r));
});

Deno.test("recovery: double-checks rows even if the lookup returns something it shouldn't", async () => {
  const s = store([realLink], { lieInLookup: [realLink, { ...oldTest("x"), tenant_id: OTHER }] });
  const r = await recoverStaleTestLinks(s.client, { tenantId: T, now: NOW, ...quiet });
  assert(r.deleted === 0 && r.skipped === 2 && s.db.has("real"), JSON.stringify(r));
});

Deno.test("recovery: refuses any business other than the test business", async () => {
  const s = store([{ ...oldTest("a"), tenant_id: OTHER }]);
  const e = await throws(recoverStaleTestLinks(s.client, { tenantId: OTHER, now: NOW, ...quiet }));
  assert(e?.includes("not the test business") && s.db.size === 1, String(e));
  const e2 = await throws(recoverStaleTestLinks(s.client, { tenantId: "", now: NOW, ...quiet }));
  assert(e2?.includes("not the test business"), String(e2));
});

Deno.test("recovery: refuses a stale age under 1 minute (would hit running tests)", async () => {
  const e = await throws(recoverStaleTestLinks(store([]).client, { tenantId: T, now: NOW, staleAfterMs: 1000, ...quiet }));
  assert(e?.includes("at least 1 minute"), String(e));
});

Deno.test("recovery: nothing to do is a pass", async () => {
  const r = await recoverStaleTestLinks(store([realLink]).client, { tenantId: T, now: NOW, ...quiet });
  assert(r.deleted === 0 && r.found === 0, JSON.stringify(r));
});

Deno.test("recovery: lookup, delete and read-back errors fail, never pass silently", async () => {
  for (const o of [{ readError: true }, { deleteError: true }, { neverDelete: true }]) {
    const e = await throws(recoverStaleTestLinks(store([oldTest("a")], o).client, { tenantId: T, now: NOW, ...quiet }));
    assert(e && /failed/.test(e) && !e.includes(TEST_LINK_PREFIX), `${JSON.stringify(o)}: ${e}`);
  }
});
