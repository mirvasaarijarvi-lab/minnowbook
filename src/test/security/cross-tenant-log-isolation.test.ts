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

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// CI-safe gating: if the publishable Supabase env vars are missing (e.g. a
// fork PR build, a contributor's local checkout without `.env`, or a CI
// matrix shard that intentionally has no backend secrets), this entire
// suite skips cleanly instead of throwing in `beforeAll` and red-flagging
// the whole security workflow. Every other security test that doesn't
// need a live backend keeps running. A single always-on sanity test below
// surfaces the skip reason in the test report so the gap is visible.
const liveModeAvailable = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing — skipping live cross-tenant log isolation suite";
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
// `describe.skip.each` does not exist in vitest, so we use describe.each
// unconditionally and skip individual `it` calls inside via `liveIt` when
// we lack env. The describe block still appears in the report, but every
// test inside is marked skipped — no createClient call is made.
const liveDescribeEach = describe.each;
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

liveDescribeEach([
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

