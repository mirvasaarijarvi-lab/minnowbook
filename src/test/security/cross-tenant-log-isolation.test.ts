import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cross-tenant isolation for log tables: booking_validation_log + audit_log.
 *
 * Both tables hold sensitive operational/forensic data scoped to a single
 * tenant. The RLS surface (verified live) is:
 *
 *   booking_validation_log:
 *     - SELECT: owners/admins of the tenant, plus system_admins
 *     - INSERT: any tenant member (server writes during validation)
 *     - UPDATE/DELETE: owners/admins only
 *     - anon: NO policies at all → total denial
 *
 *   audit_log:
 *     - SELECT: owners/admins of the tenant, plus system_admins
 *     - INSERT/UPDATE/DELETE: NO policies (only the SECURITY DEFINER
 *       trigger writes); see audit-log-append-only.test.ts for that surface
 *     - anon: NO policies at all → total denial
 *
 * This suite validates the *cross-tenant* boundary as anon:
 *   - direct SELECT returns zero rows for any tenant
 *   - crafted filters (.eq tenant_id, .in tenant_id, .or, .neq) cannot
 *     coax PostgREST into returning a single row
 *   - column projection tricks (select only "id", "created_at") cannot
 *     bypass row-level filtering
 *   - high-concurrency reads do not surface a transient leak
 *
 * For a true authenticated cross-tenant probe (tenant A's owner reading
 * tenant B's logs), the right home is `cross-tenant-rls.test.ts` which
 * already seeds two real users. We deliberately don't duplicate that
 * harness here — instead we lock down the wider surface anon could attack.
 */

// Supabase URL: prefer the Vite-prefixed name (matches the app & .env),
// fall back to the bare `SUPABASE_URL` that backends/CI commonly expose
// alongside a service-role key.
const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;

// Anon/publishable key resolution.
//
// These tests probe the *anon* attack surface — they MUST run with a
// non-privileged JWT, otherwise RLS is bypassed and "no rows leaked"
// becomes vacuously false. We accept four env-var spellings in the
// following preference order so the suite runs in as many CI shapes
// as possible without ever silently using service-role:
//
//   1. VITE_SUPABASE_PUBLISHABLE_KEY  (matches app .env / Vite)
//   2. SUPABASE_PUBLISHABLE_KEY       (bare publishable key, common in CI)
//   3. SUPABASE_ANON_KEY              (legacy bare-anon-key spelling)
//   4. VITE_SUPABASE_ANON_KEY         (legacy Vite spelling)
//
// `SUPABASE_SERVICE_ROLE_KEY` is intentionally NOT a fallback for this
// list — using it would defeat the test. It is, however, considered
// at the workflow gate so a CI environment that only ships service
// role can still surface a clear, loud skip with a precise reason.
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

// We additionally inspect (but never USE) the service-role key so the
// skip reason can distinguish "no backend secrets at all" from "only
// service-role available — please also set publishable/anon".
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// CI-safe gating: if the publishable Supabase env vars are missing (e.g. a
// fork PR build, a contributor's local checkout without `.env`, or a CI
// matrix shard that intentionally has no backend secrets), this entire
// suite skips cleanly instead of throwing in `beforeAll` and red-flagging
// the whole security workflow. Every other security test that doesn't
// need a live backend keeps running. A single always-on sanity test below
// surfaces the skip reason in the test report so the gap is visible.
const liveModeAvailable = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function skipReason(): string {
  if (!SUPABASE_URL && !SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY) {
    return "No Supabase env vars present — skipping live cross-tenant log isolation suite";
  }
  if (!SUPABASE_URL) {
    return "SUPABASE_URL / VITE_SUPABASE_URL missing — skipping live cross-tenant log isolation suite";
  }
  if (!SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) {
    // Loud, specific skip: the operator wired up service-role but no
    // anon/publishable key. We refuse to silently substitute service-
    // role because it would bypass the very RLS we're testing.
    return "Only SUPABASE_SERVICE_ROLE_KEY is set — anon/publishable key is required (these probes must NOT bypass RLS). Set VITE_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY) to enable the live suite.";
  }
  if (!SUPABASE_ANON_KEY) {
    return "SUPABASE anon/publishable key missing — skipping live cross-tenant log isolation suite";
  }
  return "ok";
}

// A live tenant id used by the existing scoping suite — known to have
// audit_log + booking_validation_log rows from normal operation.
const LIVE_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";
// A second sentinel tenant id (never assigned) used for crafted-filter probes.
const FAKE_TENANT_ID = "00000000-0000-0000-0000-0000000000aa";

let anon: SupabaseClient;

const liveDescribe = liveModeAvailable ? describe : describe.skip;
// `describe.each` is a getter on the describe object; aliasing it loses
// the `this` binding and breaks. Call it directly inline below. To skip
// individual cases when env is missing, use `liveIt` inside the each body.
const liveIt = liveModeAvailable ? it : it.skip;

beforeAll(() => {
  // Only construct the client when we have the env to do so. The describe
  // blocks below are pre-skipped when liveModeAvailable is false, so this
  // body is effectively a no-op in that case — but the guard keeps the
  // intent explicit and prevents an accidental unguarded createClient if
  // future tests get added at the top level.
  if (!liveModeAvailable) return;
  anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

/**
 * Asserts a query result represents "RLS denied" — either an explicit error
 * or a silently-empty data array. Returns 0 in either case so callers can
 * compose count comparisons.
 */
function expectNoRowsLeaked(
  result: { data: unknown; error: { message?: string } | null },
  ctx: string
): number {
  const { data, error } = result;
  if (error) {
    // PostgREST may surface an explicit policy error — that's acceptable.
    return 0;
  }
  expect(Array.isArray(data), `${ctx}: result must be an array or error`).toBe(true);
  const rows = (data ?? []) as unknown[];
  expect(rows.length, `${ctx}: anon must not see any rows`).toBe(0);
  return rows.length;
}

describe.each([
  { table: "booking_validation_log" as const },
  { table: "audit_log" as const },
])("$table — anon cross-tenant read isolation", ({ table }) => {
  liveIt("plain SELECT returns zero rows", async () => {
    const result = await anon.from(table).select("*").limit(50);
    expectNoRowsLeaked(result, `${table} plain select`);
  });

  liveIt("filtered by real tenant_id returns zero rows", async () => {
    const result = await anon
      .from(table)
      .select("*")
      .eq("tenant_id", LIVE_TENANT_ID)
      .limit(50);
    expectNoRowsLeaked(result, `${table} eq real tenant_id`);
  });

  liveIt("filtered by fake tenant_id returns zero rows", async () => {
    const result = await anon
      .from(table)
      .select("*")
      .eq("tenant_id", FAKE_TENANT_ID)
      .limit(50);
    expectNoRowsLeaked(result, `${table} eq fake tenant_id`);
  });

  liveIt(".in([real, fake]) cannot smuggle rows past RLS", async () => {
    const result = await anon
      .from(table)
      .select("*")
      .in("tenant_id", [LIVE_TENANT_ID, FAKE_TENANT_ID])
      .limit(50);
    expectNoRowsLeaked(result, `${table} in tenant_id list`);
  });

  liveIt(".neq tenant_id (broad scan) cannot smuggle rows past RLS", async () => {
    const result = await anon
      .from(table)
      .select("*")
      .neq("tenant_id", FAKE_TENANT_ID)
      .limit(50);
    expectNoRowsLeaked(result, `${table} neq tenant_id`);
  });

  liveIt(".or() with multiple tenant_id branches cannot smuggle rows past RLS", async () => {
    const result = await anon
      .from(table)
      .select("*")
      .or(`tenant_id.eq.${LIVE_TENANT_ID},tenant_id.eq.${FAKE_TENANT_ID}`)
      .limit(50);
    expectNoRowsLeaked(result, `${table} or tenant_id branches`);
  });

  liveIt("narrow column projection (id only) cannot leak row existence", async () => {
    // A common bypass attempt: ask only for `id` to count rows. RLS filters
    // rows, not columns, so this must still return zero.
    const result = await anon
      .from(table)
      .select("id")
      .eq("tenant_id", LIVE_TENANT_ID)
      .limit(50);
    expectNoRowsLeaked(result, `${table} id-only projection`);
  });

  liveIt("HEAD count query cannot reveal row count", async () => {
    // count: "exact" with head:true returns no rows but reports the count.
    // Under RLS denial the count must be 0 (or null) — never the real
    // number of rows in the tenant.
    const { count, error } = await anon
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", LIVE_TENANT_ID);
    if (error) {
      // Acceptable: explicit denial.
      expect(error).toBeTruthy();
    } else {
      expect(count ?? 0, `${table} HEAD count must not leak true cardinality`).toBe(0);
    }
  });

  liveIt("ordering by created_at desc cannot surface latest rows", async () => {
    const result = await anon
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    expectNoRowsLeaked(result, `${table} order by created_at`);
  });

  liveIt("50 parallel reads with mixed filters never surface a leak", async () => {
    const PARALLEL = 50;
    const queries = Array.from({ length: PARALLEL }, (_, i) => {
      const tid = i % 2 === 0 ? LIVE_TENANT_ID : FAKE_TENANT_ID;
      return anon.from(table).select("id, tenant_id").eq("tenant_id", tid).limit(5);
    });
    const results = await Promise.all(queries);
    for (const r of results) {
      expectNoRowsLeaked(r, `${table} parallel read`);
    }
  }, 30_000);
});

/**
 * Pagination-based isolation probes.
 *
 * Even when a single SELECT correctly returns zero rows under RLS, a
 * naive paginator could still leak signal at page boundaries:
 *
 *   - `range(0, N)` walks could surface rows on a later page if RLS were
 *     applied per-batch instead of per-row.
 *   - Deep `range(largeOffset, largeOffset+pageSize)` queries could
 *     bypass index-time filters in some misconfigurations.
 *   - `count: "exact"` returned alongside paginated rows could leak
 *     the *true* tenant cardinality even when `data` is empty.
 *   - Cursor-style queries (`.gt("created_at", cursor)`) could surface
 *     a row that the same query without the cursor wouldn't.
 *   - Reverse-order pagination could surface the newest row first
 *     (a common timing/leak primitive).
 *
 * Every probe below must return zero rows AND, where applicable, a
 * count of 0 (or null). Any non-zero result is a pagination-boundary
 * RLS leak.
 */
describe.each([
  { table: "booking_validation_log" as const },
  { table: "audit_log" as const },
])("$table — anon pagination isolation", ({ table }) => {
  liveIt("range(0, 9) returns zero rows", async () => {
    const result = await anon.from(table).select("*").range(0, 9);
    expectNoRowsLeaked(result, `${table} range(0,9)`);
  });

  liveIt("range(0, 999) (large first page) returns zero rows", async () => {
    const result = await anon.from(table).select("*").range(0, 999);
    expectNoRowsLeaked(result, `${table} range(0,999)`);
  });

  liveIt("sequential pages 0-9, 10-19, 20-29 never surface a row", async () => {
    // Walks the first three pages of size 10. If RLS were applied at
    // batch boundaries (or only to the first page), a later page could
    // leak. Each page must be independently empty.
    const PAGE_SIZE = 10;
    const PAGES = 3;
    for (let p = 0; p < PAGES; p++) {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const result = await anon.from(table).select("*").range(from, to);
      expectNoRowsLeaked(result, `${table} page ${p} range(${from},${to})`);
    }
  });

  liveIt("deep offset range(10000, 10024) returns zero rows", async () => {
    // A deep offset bypass: some misconfigured paginators stop applying
    // filters past a high offset. RLS must hold regardless of offset.
    const result = await anon.from(table).select("*").range(10_000, 10_024);
    expectNoRowsLeaked(result, `${table} deep range(10000,10024)`);
  });

  liveIt("range with eq tenant_id filter returns zero rows on every page", async () => {
    const PAGE_SIZE = 5;
    for (let p = 0; p < 4; p++) {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const result = await anon
        .from(table)
        .select("*")
        .eq("tenant_id", LIVE_TENANT_ID)
        .range(from, to);
      expectNoRowsLeaked(result, `${table} eq+range page ${p}`);
    }
  });

  liveIt("count:'exact' alongside paginated select must not leak cardinality", async () => {
    // The classic count-leak: PostgREST returns `data: []` (correctly
    // RLS-filtered) but a non-zero `count` would still expose the true
    // number of rows in the target tenant. RLS must filter the count too.
    const { data, count, error } = await anon
      .from(table)
      .select("*", { count: "exact" })
      .eq("tenant_id", LIVE_TENANT_ID)
      .range(0, 9);
    if (error) {
      // Acceptable: explicit denial.
      expect(error).toBeTruthy();
      return;
    }
    const rows = (data ?? []) as unknown[];
    expect(rows.length, `${table} count+page rows must be 0`).toBe(0);
    expect(count ?? 0, `${table} count must not leak true cardinality`).toBe(0);
  });

  liveIt("count:'planned' returns no rows (planner estimate is global, not per-tenant)", async () => {
    // PostgREST `count: "planned"` and `count: "estimated"` come from
    // `pg_class.reltuples` — the planner's table-level row estimate.
    // These are NOT RLS-filtered by design (they're global table
    // metadata, not row data) and therefore reveal only total table
    // size, never per-tenant cardinality. The actual security boundary
    // is `data`, which must remain empty. We assert that here and
    // document the planner-count caveat so future readers don't
    // mistake it for a leak. Use `count: "exact"` (tested above) when
    // you need a count that respects RLS.
    const { data, error } = await anon
      .from(table)
      .select("*", { count: "planned" })
      .range(0, 9);
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    const rows = (data ?? []) as unknown[];
    expect(rows.length, `${table} planned-count rows must be 0`).toBe(0);
  });

  liveIt("count:'estimated' returns no rows (planner estimate is global, not per-tenant)", async () => {
    // Same caveat as `planned` above — `estimated` falls back to the
    // planner row estimate when an exact count would be expensive.
    // We only assert `data` is empty.
    const { data, error } = await anon
      .from(table)
      .select("*", { count: "estimated" })
      .range(0, 9);
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    const rows = (data ?? []) as unknown[];
    expect(rows.length, `${table} estimated-count rows must be 0`).toBe(0);
  });

  liveIt("cursor-style .gt('created_at', epoch) + order + limit returns zero rows", async () => {
    // Cursor pagination is the recommended pattern for deep pagination;
    // attackers will reach for it as a bypass too. Anchor at unix epoch
    // so the cursor matches every possible row in the tenant.
    const result = await anon
      .from(table)
      .select("*")
      .eq("tenant_id", LIVE_TENANT_ID)
      .gt("created_at", "1970-01-01T00:00:00Z")
      .order("created_at", { ascending: true })
      .limit(25);
    expectNoRowsLeaked(result, `${table} cursor .gt(epoch) page`);
  });

  liveIt("cursor walk (3 hops with .gt + order + limit) never surfaces a row", async () => {
    // Simulate three hops of forward cursor pagination. Even if the
    // first hop is empty, an attacker may try advancing the cursor
    // manually past a guessed boundary. Each hop must return zero.
    let cursor = "1970-01-01T00:00:00Z";
    for (let hop = 0; hop < 3; hop++) {
      const result = await anon
        .from(table)
        .select("created_at, id, tenant_id")
        .gt("created_at", cursor)
        .order("created_at", { ascending: true })
        .limit(10);
      expectNoRowsLeaked(result, `${table} cursor hop ${hop}`);
      // Advance cursor by an arbitrary year — there's nothing to read,
      // so we just keep probing forward in time.
      cursor = new Date(Date.parse(cursor) + 365 * 24 * 3600 * 1000).toISOString();
    }
  });

  liveIt("reverse cursor (.lt + descending order) returns zero rows", async () => {
    // Newest-first pagination is the most attractive primitive for an
    // attacker: it would reveal the latest activity. Anchor in the far
    // future to include every possible row in the tenant.
    const result = await anon
      .from(table)
      .select("*")
      .eq("tenant_id", LIVE_TENANT_ID)
      .lt("created_at", "2999-12-31T23:59:59Z")
      .order("created_at", { ascending: false })
      .limit(25);
    expectNoRowsLeaked(result, `${table} reverse cursor .lt(future)`);
  });

  liveIt("range with column projection ('id') on every page returns zero rows", async () => {
    // Combine projection narrowing with pagination — a common bypass
    // attempt to reduce response size and slip past detection.
    const PAGE_SIZE = 20;
    for (let p = 0; p < 3; p++) {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const result = await anon.from(table).select("id").range(from, to);
      expectNoRowsLeaked(result, `${table} id-only page ${p}`);
    }
  });

  liveIt("range across .in([live, fake]) tenant_id filter on multiple pages returns zero rows", async () => {
    // Combine a multi-tenant `in` filter with pagination — RLS must
    // still strip every row regardless of how the filter shapes the plan.
    const PAGE_SIZE = 10;
    for (let p = 0; p < 3; p++) {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const result = await anon
        .from(table)
        .select("id, tenant_id")
        .in("tenant_id", [LIVE_TENANT_ID, FAKE_TENANT_ID])
        .range(from, to);
      expectNoRowsLeaked(result, `${table} in+range page ${p}`);
    }
  });
});

liveDescribe("booking_validation_log — anon cannot write or mutate cross-tenant", () => {
  // booking_validation_log INSERT is restricted to authenticated tenant
  // members. Anon must not be able to forge entries (which would pollute
  // the tenant's forensic record) or delete entries (which would let an
  // attacker hide their own probe attempts).

  it("anon INSERT into another tenant is denied", async () => {
    const { data, error } = await anon.from("booking_validation_log").insert({
      tenant_id: LIVE_TENANT_ID,
      source: "anon-forgery",
      outcome: "approved",
      reasons: [],
    } as never);
    expect(error, "anon insert must be denied").toBeTruthy();
    const rows = (data ?? []) as unknown[];
    expect(rows.length).toBe(0);
  });

  it("anon UPDATE on another tenant's rows returns no affected rows", async () => {
    const result = await anon
      .from("booking_validation_log")
      .update({ outcome: "tampered" } as never)
      .eq("tenant_id", LIVE_TENANT_ID)
      .select();
    const rows = (result.data ?? []) as unknown[];
    expect(rows.length, "anon update must not affect rows").toBe(0);
  });

  it("anon DELETE on another tenant's rows returns no affected rows", async () => {
    const result = await anon
      .from("booking_validation_log")
      .delete()
      .eq("tenant_id", LIVE_TENANT_ID)
      .select();
    const rows = (result.data ?? []) as unknown[];
    expect(rows.length, "anon delete must not affect rows").toBe(0);
  });
});

/**
 * Pagination + token-scoped filter probes.
 *
 * Threat model: an attacker who has guessed (or stolen) a single
 * `booking_token` reservation handle — but where the token is
 * **revoked** or **expired** — must not be able to use it as a
 * filter to page through `booking_validation_log` or `audit_log`
 * and infer:
 *
 *   - whether the token (or its reservation) ever existed,
 *   - whether the underlying record exists in either log,
 *   - the *count* of related rows in either log,
 *   - timing/ordering information about recent activity.
 *
 * Both log tables expose a per-row handle that is the natural join
 * target for a booking token (`booking_tokens.reservation_id`):
 *   - booking_validation_log.reservation_id
 *   - audit_log.record_id (holds the reservation id for reservation rows)
 *
 * RLS must hide every row from anon regardless of how that handle
 * is paginated, sorted, or counted, AND the response must be
 * indistinguishable between a "real but RLS-hidden" id and a fully
 * fabricated id — otherwise the response shape itself becomes the
 * existence oracle a revoked-token attacker would exploit.
 *
 * Anon is intentional here: this exercises the public attack surface
 * a leaked-but-revoked token would expose to the outside world. The
 * three sentinel handles below simulate the three cases the attacker
 * cannot tell apart from outside RLS:
 *   - REVOKED_TOKEN_RES_ID: matches a token whose `is_revoked=true`
 *   - EXPIRED_TOKEN_RES_ID: matches a token whose `expires_at < now()`
 *   - FAKE_RES_ID: never existed at all
 */
const REVOKED_TOKEN_RES_ID = "00000000-0000-0000-0000-0000000000b1";
const EXPIRED_TOKEN_RES_ID = "00000000-0000-0000-0000-0000000000b2";
const FAKE_RES_ID = "00000000-0000-0000-0000-0000000000b3";

describe.each([
  {
    table: "booking_validation_log" as const,
    handleColumn: "reservation_id" as const,
  },
  {
    table: "audit_log" as const,
    handleColumn: "record_id" as const,
  },
])("$table — token-scoped pagination cannot leak existence", ({ table, handleColumn }) => {
  type Shape = { error: boolean; rows: number; count: number | null };
  function shapeOf(result: {
    data: unknown;
    error: { message?: string } | null;
    count?: number | null;
  }): Shape {
    if (result.error) return { error: true, rows: 0, count: null };
    const rows = Array.isArray(result.data) ? (result.data as unknown[]).length : 0;
    return { error: false, rows, count: result.count ?? null };
  }

  liveIt("range(0, 9) by handle returns zero rows for revoked/expired/fake", async () => {
    const shapes: Shape[] = [];
    for (const handle of [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID]) {
      const result = await anon
        .from(table)
        .select("*")
        .eq(handleColumn, handle)
        .range(0, 9);
      expectNoRowsLeaked(result, `${table} range(0,9) ${handleColumn}=${handle}`);
      shapes.push(shapeOf(result));
    }
    // Indistinguishability: revoked, expired, fake must all look the same.
    expect(shapes[0]).toEqual(shapes[1]);
    expect(shapes[1]).toEqual(shapes[2]);
  });

  liveIt("sequential pages 0-9, 10-19, 20-29 by handle leak no row + identical shapes", { timeout: 30_000 }, async () => {
    const PAGE_SIZE = 10;
    const PAGES = 3;
    const perHandle: Shape[][] = [];
    for (const handle of [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID]) {
      const pages: Shape[] = [];
      for (let p = 0; p < PAGES; p++) {
        const from = p * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const result = await anon
          .from(table)
          .select("*")
          .eq(handleColumn, handle)
          .range(from, to);
        expectNoRowsLeaked(
          result,
          `${table} ${handleColumn}=${handle} page ${p} range(${from},${to})`
        );
        pages.push(shapeOf(result));
      }
      perHandle.push(pages);
    }
    expect(perHandle[0]).toEqual(perHandle[1]);
    expect(perHandle[1]).toEqual(perHandle[2]);
  });

  liveIt("deep offset range(10000, 10024) by handle returns zero rows", { timeout: 15_000 }, async () => {
    const shapes: Shape[] = [];
    for (const handle of [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID]) {
      const result = await anon
        .from(table)
        .select("*")
        .eq(handleColumn, handle)
        .range(10_000, 10_024);
      expectNoRowsLeaked(
        result,
        `${table} deep offset ${handleColumn}=${handle}`
      );
      shapes.push(shapeOf(result));
    }
    expect(shapes[0]).toEqual(shapes[1]);
    expect(shapes[1]).toEqual(shapes[2]);
  });

  liveIt("HEAD count by handle never reveals row count for revoked/expired/fake", async () => {
    // The most direct existence oracle: ask for the count alone. RLS
    // must collapse all three (revoked / expired / fake) to 0 or null.
    const counts: Array<number | null> = [];
    for (const handle of [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID]) {
      const { count, error } = await anon
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(handleColumn, handle);
      if (error) {
        counts.push(null);
      } else {
        expect(
          count ?? 0,
          `${table} HEAD count by ${handleColumn}=${handle} must not leak existence`
        ).toBe(0);
        counts.push(count ?? 0);
      }
    }
    expect(counts[0]).toBe(counts[1]);
    expect(counts[1]).toBe(counts[2]);
  });

  liveIt("count alongside paginated rows by handle leaks neither rows nor cardinality", async () => {
    const shapes: Shape[] = [];
    for (const handle of [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID]) {
      const result = await anon
        .from(table)
        .select("*", { count: "exact" })
        .eq(handleColumn, handle)
        .range(0, 9);
      if (!result.error) {
        const rows = Array.isArray(result.data) ? (result.data as unknown[]).length : 0;
        expect(rows, `${table} count+range data leak ${handle}`).toBe(0);
        expect(result.count ?? 0, `${table} count+range count leak ${handle}`).toBe(0);
      }
      shapes.push(shapeOf(result));
    }
    expect(shapes[0]).toEqual(shapes[1]);
    expect(shapes[1]).toEqual(shapes[2]);
  });

  liveIt("reverse-order pagination by handle cannot surface latest rows", async () => {
    const shapes: Shape[] = [];
    for (const handle of [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID]) {
      const result = await anon
        .from(table)
        .select("id, created_at")
        .eq(handleColumn, handle)
        .order("created_at", { ascending: false })
        .range(0, 4);
      expectNoRowsLeaked(
        result,
        `${table} reverse pagination ${handleColumn}=${handle}`
      );
      shapes.push(shapeOf(result));
    }
    expect(shapes[0]).toEqual(shapes[1]);
    expect(shapes[1]).toEqual(shapes[2]);
  });

  liveIt("cursor walk (.gt created_at + handle filter) never surfaces a row", { timeout: 30_000 }, async () => {
    // Forward hops anchored at the unix epoch — covers a misconfigured
    // cursor-style paginator that drops the policy on subsequent hops.
    const HOPS = 3;
    for (const handle of [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID]) {
      let cursor = "1970-01-01T00:00:00Z";
      for (let h = 0; h < HOPS; h++) {
        const result = await anon
          .from(table)
          .select("id, created_at")
          .eq(handleColumn, handle)
          .gt("created_at", cursor)
          .order("created_at", { ascending: true })
          .limit(5);
        expectNoRowsLeaked(
          result,
          `${table} cursor hop ${h} ${handleColumn}=${handle}`
        );
        cursor = new Date(Date.now() - (HOPS - h) * 1000).toISOString();
      }
    }
  });

  liveIt("combined tenant_id + handle pagination leaks neither row nor count", async () => {
    const PAGE_SIZE = 10;
    const PAGES = 2;
    const perHandle: Shape[][] = [];
    for (const handle of [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID]) {
      const pages: Shape[] = [];
      for (let p = 0; p < PAGES; p++) {
        const from = p * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const result = await anon
          .from(table)
          .select("*", { count: "exact" })
          .eq("tenant_id", LIVE_TENANT_ID)
          .eq(handleColumn, handle)
          .range(from, to);
        expectNoRowsLeaked(
          result,
          `${table} tenant+handle ${handleColumn}=${handle} page ${p}`
        );
        if (!result.error) {
          expect(
            result.count ?? 0,
            `${table} tenant+handle count leak ${handle} page ${p}`
          ).toBe(0);
        }
        pages.push(shapeOf(result));
      }
      perHandle.push(pages);
    }
    expect(perHandle[0]).toEqual(perHandle[1]);
    expect(perHandle[1]).toEqual(perHandle[2]);
  });

  liveIt(".in([revoked, expired, fake]) handle list cannot smuggle rows past RLS", async () => {
    const result = await anon
      .from(table)
      .select("*", { count: "exact" })
      .in(handleColumn, [REVOKED_TOKEN_RES_ID, EXPIRED_TOKEN_RES_ID, FAKE_RES_ID])
      .range(0, 49);
    expectNoRowsLeaked(result, `${table} in([revoked,expired,fake])`);
    if (!result.error) {
      expect(result.count ?? 0, `${table} in() count must not leak`).toBe(0);
    }
  });
});

liveDescribe("sanity guard", () => {
  it("anon client has no user session (prevents service-role false positives)", async () => {
    const { data } = await anon.auth.getUser();
    expect(data.user).toBeNull();
  });
});

// Always-on gating test: surfaces whether the live suite ran or was skipped
// so the security report makes the gap visible even on no-secrets CI runs.
describe("cross-tenant log isolation — gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(`[cross-tenant-log-isolation] live mode skipped: ${skipReason()}`);
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});

