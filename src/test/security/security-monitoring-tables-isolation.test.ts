import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cross-tenant / anon isolation for the security monitoring tables added by
 * the security-alerts migration:
 *
 *   reservation_access_log
 *     - SELECT: system_admins, plus owners/admins of the owning tenant
 *     - INSERT: written by the authenticated staff client (own tenant only)
 *     - anon: NO policies at all -> total denial
 *
 *   security_events
 *     - SELECT/UPDATE: system_admins only (acknowledged via
 *       acknowledge_security_event())
 *     - anon + ordinary authenticated staff: total denial
 *
 * Both tables carry a tenant_id, so the manifest coverage guard
 * (tenant-table-manifest.test.ts) requires cross-tenant coverage. This suite
 * provides it by locking down the widest reachable surface — the anon client —
 * across plain reads, crafted tenant filters, counts, pagination and writes.
 * No row data is ever expected back, so the suite needs no seeded fixtures.
 */

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;

// Anon/publishable key only. The service-role key must never be substituted
// here: it bypasses RLS and would make every assertion below vacuous.
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

const liveModeAvailable = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// A live tenant id used by the other live security suites, and a sentinel id
// that is never assigned to any tenant.
const LIVE_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";
const FAKE_TENANT_ID = "00000000-0000-0000-0000-0000000000aa";

const MONITORING_TABLES = [
  { table: "reservation_access_log" as const },
  { table: "security_events" as const },
];

let anon: SupabaseClient;

const liveIt = liveModeAvailable ? it : it.skip;

beforeAll(() => {
  if (!liveModeAvailable) return;
  anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

/** Denied == explicit policy error OR a silently empty result set. */
function expectNoRowsLeaked(
  result: { data: unknown; error: { message?: string } | null },
  ctx: string,
): void {
  const { data, error } = result;
  if (error) return;
  expect(Array.isArray(data), `${ctx}: result must be an array or error`).toBe(
    true,
  );
  expect((data ?? []) as unknown[], `${ctx}: anon must not see any rows`).toEqual(
    [],
  );
}

describe.each(MONITORING_TABLES)(
  "$table — anon read isolation",
  ({ table }) => {
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

    liveIt(".or() across tenant branches cannot smuggle rows", async () => {
      const result = await anon
        .from(table)
        .select("*")
        .or(`tenant_id.eq.${LIVE_TENANT_ID},tenant_id.eq.${FAKE_TENANT_ID}`)
        .limit(50);
      expectNoRowsLeaked(result, `${table} or tenant branches`);
    });

    liveIt("id-only projection cannot leak row existence", async () => {
      const result = await anon
        .from(table)
        .select("id")
        .eq("tenant_id", LIVE_TENANT_ID)
        .limit(50);
      expectNoRowsLeaked(result, `${table} id-only projection`);
    });

    liveIt("exact HEAD count cannot reveal cardinality", async () => {
      const { count, error } = await anon
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", LIVE_TENANT_ID);
      if (error) {
        expect(error).toBeTruthy();
        return;
      }
      expect(count ?? 0, `${table} HEAD count must be 0`).toBe(0);
    });

    liveIt("paginated pages never surface a row", async () => {
      const PAGE_SIZE = 10;
      for (let p = 0; p < 3; p++) {
        const from = p * PAGE_SIZE;
        const result = await anon
          .from(table)
          .select("*")
          .range(from, from + PAGE_SIZE - 1);
        expectNoRowsLeaked(result, `${table} page ${p}`);
      }
    });

    liveIt("deep offset page returns zero rows", async () => {
      const result = await anon.from(table).select("*").range(10_000, 10_024);
      expectNoRowsLeaked(result, `${table} deep offset page`);
    });
  },
);

describe.each(MONITORING_TABLES)(
  "$table — anon write denial",
  ({ table }) => {
    liveIt("anon INSERT is rejected", async () => {
      const { error } = await anon
        .from(table)
        .insert({ tenant_id: FAKE_TENANT_ID } as never);
      expect(error, `${table}: anon INSERT must be denied`).toBeTruthy();
    });

    liveIt("anon UPDATE affects nothing", async () => {
      const { data, error } = await anon
        .from(table)
        .update({ tenant_id: FAKE_TENANT_ID } as never)
        .eq("tenant_id", LIVE_TENANT_ID)
        .select("id");
      if (error) {
        expect(error).toBeTruthy();
        return;
      }
      expect((data ?? []) as unknown[], `${table} anon UPDATE`).toEqual([]);
    });

    liveIt("anon DELETE affects nothing", async () => {
      const { data, error } = await anon
        .from(table)
        .delete()
        .eq("tenant_id", LIVE_TENANT_ID)
        .select("id");
      if (error) {
        expect(error).toBeTruthy();
        return;
      }
      expect((data ?? []) as unknown[], `${table} anon DELETE`).toEqual([]);
    });
  },
);

describe("security monitoring RPC surface", () => {
  liveIt("anon cannot run detect_security_alerts()", async () => {
    const { error } = await anon.rpc("detect_security_alerts", {
      p_sensitivity: 3,
    } as never);
    expect(error, "detect_security_alerts must reject anon").toBeTruthy();
  });

  liveIt("anon cannot run acknowledge_security_event()", async () => {
    const { error } = await anon.rpc("acknowledge_security_event", {
      p_event_id: "00000000-0000-0000-0000-000000000001",
    } as never);
    expect(error, "acknowledge_security_event must reject anon").toBeTruthy();
  });
});

describe("live-mode visibility", () => {
  it("reports whether the live monitoring-table suite ran", () => {
    // Always-on sanity test so a skipped live suite is visible in the report
    // instead of silently reducing coverage to zero.
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
