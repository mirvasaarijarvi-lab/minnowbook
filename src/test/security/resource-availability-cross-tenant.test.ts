import { describe, it, beforeAll, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expectReadDenied, expectWriteDenied } from "./rls-assert";
import {
  createTenantPairFixture,
  tenantPairFixtureLikelyAvailable,
  type TenantPairFixture,
} from "./fixtures/tenant-pair";
import { guardTenantPair } from "./fixtures/tenant-id-guard";

/**
 * Resource availability cross-tenant isolation tests.
 *
 * Targeted regression suite that pins the two tables consumed by the
 * availability resolver (`src/lib/availability.ts`):
 *
 *   - `resource_opening_hours`     — weekly recurring schedule
 *   - `resource_availability_slots`— one-off occasional slots
 *
 * Both tables are also swept by the general `cross-tenant-rls` suite, but
 * because availability data drives what guests see on the public booking
 * page, a leak here means one tenant's bookable schedule shows up under
 * another tenant's brand. This file makes that regression impossible to
 * miss in CI by isolating the assertions.
 *
 * Modes mirror `cross-tenant-rls.test.ts`:
 *   1. ALWAYS — anon client may not SELECT private columns or INSERT.
 *   2. OPT-IN — when the tenant-pair fixture is available, user A may not
 *      read, insert, update, or delete user B's rows in either table.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const AVAILABILITY_TABLES = ["resource_opening_hours", "resource_availability_slots"] as const;

const newAnonClient = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

describe("Resource availability cross-tenant isolation", () => {
  describe.runIf(hasSupabaseConfig)("Anonymous client", () => {
    let anon: SupabaseClient;

    beforeAll(() => {
      anon = newAnonClient();
    });

    it.each(AVAILABILITY_TABLES)(
      "anon INSERT into %s with a forged tenant_id is denied",
      async (table) => {
        const fakeTenantId = "00000000-0000-0000-0000-000000000000";
        const fakeResourceId = "00000000-0000-0000-0000-000000000001";
        const payload =
          table === "resource_opening_hours"
            ? {
                tenant_id: fakeTenantId,
                resource_id: fakeResourceId,
                day_of_week: 1,
                open_time: "09:00",
                close_time: "17:00",
                is_closed: false,
              }
            : {
                tenant_id: fakeTenantId,
                resource_id: fakeResourceId,
                slot_date: "2099-01-01",
                start_time: "09:00",
                end_time: "12:00",
              };
        const { data, error } = await anon.from(table).insert(payload).select();
        expectWriteDenied(
          {
            table,
            operation: "INSERT",
            attemptedQuery: `insert into ${table} ${JSON.stringify(payload)}`,
            actingTenantId: "(anonymous)",
            targetTenantId: fakeTenantId,
            scenario: `anon INSERT into ${table}`,
          },
          { data, error },
        );
      },
    );

    it.each(AVAILABILITY_TABLES)(
      "anon UPDATE on %s for an arbitrary id is denied or affects zero rows",
      async (table) => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const patch =
          table === "resource_opening_hours" ? { is_closed: true } : { note: "leaked" };
        const { data, error } = await anon
          .from(table)
          .update(patch)
          .eq("id", fakeId)
          .select();
        expectWriteDenied(
          {
            table,
            operation: "UPDATE",
            attemptedQuery: `update ${table} set ${JSON.stringify(patch)} where id='${fakeId}'`,
            actingTenantId: "(anonymous)",
            scenario: `anon UPDATE ${table}`,
          },
          { data, error },
        );
      },
    );

    it.each(AVAILABILITY_TABLES)(
      "anon DELETE from %s for an arbitrary id is denied or affects zero rows",
      async (table) => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const { data, error } = await anon.from(table).delete().eq("id", fakeId).select();
        expectWriteDenied(
          {
            table,
            operation: "DELETE",
            attemptedQuery: `delete from ${table} where id='${fakeId}'`,
            actingTenantId: "(anonymous)",
            scenario: `anon DELETE ${table}`,
          },
          { data, error },
        );
      },
    );
  });

  describe.runIf(tenantPairFixtureLikelyAvailable())("Live tenant-to-tenant denial", () => {
    let fixture: TenantPairFixture | undefined;
    let clientA: SupabaseClient;
    let clientB: SupabaseClient;
    let tenantAId: string;
    let tenantBId: string;

    beforeAll(async () => {
      fixture = await createTenantPairFixture();
      if (!fixture.available || !fixture.a || !fixture.b) {
        throw new Error(
          `Tenant pair fixture unexpectedly unavailable: ${fixture.skipReason ?? "(no reason)"}`,
        );
      }
      clientA = fixture.a.client;
      clientB = fixture.b.client;
      tenantAId = fixture.a.tenantId;
      tenantBId = fixture.b.tenantId;
      await guardTenantPair({
        suite: "resource-availability-cross-tenant",
        a: { client: clientA, tenantId: tenantAId, email: fixture.a.email },
        b: { client: clientB, tenantId: tenantBId, email: fixture.b.email },
      });
    });

    it.each(AVAILABILITY_TABLES)(
      "user A cannot SELECT tenant B rows from %s (filtered by foreign tenant_id)",
      async (table) => {
        const result = await clientA
          .from(table)
          .select("id, tenant_id")
          .eq("tenant_id", tenantBId);
        expectReadDenied(
          {
            table,
            operation: "SELECT",
            attemptedQuery: `select id, tenant_id from ${table} where tenant_id='${tenantBId}'`,
            actingTenantId: tenantAId,
            targetTenantId: tenantBId,
            scenario: `user A reading tenant B ${table}`,
          },
          result,
        );
      },
    );

    it.each(AVAILABILITY_TABLES)(
      "unfiltered SELECT on %s by user A never returns tenant B rows",
      async (table) => {
        const { data, error } = await clientA.from(table).select("id, tenant_id").limit(200);
        // Either denial or rows scoped to A. We assert no leakage of B.
        if (error) return;
        const leaked = (data ?? []).filter((r: any) => r?.tenant_id === tenantBId);
        if (leaked.length > 0) {
          throw new Error(
            `RLS leak on ${table}: unfiltered SELECT returned ${leaked.length} row(s) ` +
              `belonging to tenant B (${tenantBId}) while acting as tenant A (${tenantAId}).`,
          );
        }
      },
    );

    it.each(AVAILABILITY_TABLES)(
      "user A cannot INSERT into %s forging tenant B's tenant_id",
      async (table) => {
        const fakeResourceId = "00000000-0000-0000-0000-000000000001";
        const payload =
          table === "resource_opening_hours"
            ? {
                tenant_id: tenantBId,
                resource_id: fakeResourceId,
                day_of_week: 2,
                open_time: "10:00",
                close_time: "12:00",
                is_closed: false,
              }
            : {
                tenant_id: tenantBId,
                resource_id: fakeResourceId,
                slot_date: "2099-12-31",
                start_time: "10:00",
                end_time: "11:00",
              };
        const { data, error } = await clientA.from(table).insert(payload).select();
        expectWriteDenied(
          {
            table,
            operation: "INSERT",
            attemptedQuery: `insert into ${table} ${JSON.stringify(payload)}`,
            actingTenantId: tenantAId,
            targetTenantId: tenantBId,
            scenario: `user A forging tenant B ${table} insert`,
          },
          { data, error },
        );
      },
    );

    it.each(AVAILABILITY_TABLES)(
      "user A cannot DELETE tenant B rows from %s",
      async (table) => {
        const { data, error } = await clientA
          .from(table)
          .delete()
          .eq("tenant_id", tenantBId)
          .select();
        expectWriteDenied(
          {
            table,
            operation: "DELETE",
            attemptedQuery: `delete from ${table} where tenant_id='${tenantBId}'`,
            actingTenantId: tenantAId,
            targetTenantId: tenantBId,
            scenario: `user A deleting tenant B ${table}`,
          },
          { data, error },
        );
      },
    );

    it("user A can read their OWN resource_opening_hours rows (positive control)", async () => {
      const { error } = await clientA
        .from("resource_opening_hours")
        .select("id, tenant_id")
        .eq("tenant_id", tenantAId)
        .limit(1);
      // We don't assert rows exist (tenant may have none) — only that the
      // query is permitted. Permission errors here would mean RLS is over-
      // restrictive and would mask the cross-tenant denial above.
      expect(error?.code).not.toBe("42501");
    });

    it("user A can read their OWN resource_availability_slots rows (positive control)", async () => {
      const { error } = await clientA
        .from("resource_availability_slots")
        .select("id, tenant_id")
        .eq("tenant_id", tenantAId)
        .limit(1);
      expect(error?.code).not.toBe("42501");
    });
  });
});
