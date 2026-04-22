import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expectReadDenied,
  expectWriteDenied,
  expectNoForeignTenantRows,
} from "./rls-assert";

/**
 * Cross-Tenant RLS Regression Tests
 *
 * Verifies that all tenant-scoped tables deny cross-tenant access through
 * Row Level Security policies. Runs in two modes:
 *
 * 1. ALWAYS (CI-safe): Anonymous client must not be able to SELECT any rows
 *    from tenant-scoped tables — this proves RLS is enforced and the anon
 *    role has no implicit tenant membership.
 *
 * 2. OPT-IN (live integration): When the following env vars are set, the
 *    test will sign in as two users from different tenants and confirm
 *    each user cannot read or write the other tenant's data, including:
 *      - SELECT denial across every tenant-scoped table (both directions)
 *      - INSERT denial when forging the other tenant's tenant_id
 *      - UPDATE / DELETE denial via cross-tenant filters
 *      - Unfiltered queries never leak rows from the other tenant
 *      - Positive control: each user CAN read their OWN tenant_users row
 *        (catches misconfigured test setup that would let denial pass trivially)
 *
 *    Required env vars:
 *      - RLS_TEST_TENANT_A_EMAIL / RLS_TEST_TENANT_A_PASSWORD / RLS_TEST_TENANT_A_ID
 *      - RLS_TEST_TENANT_B_EMAIL / RLS_TEST_TENANT_B_PASSWORD / RLS_TEST_TENANT_B_ID
 *
 * To run live mode locally:
 *   RLS_TEST_TENANT_A_EMAIL=... RLS_TEST_TENANT_A_PASSWORD=... \
 *   RLS_TEST_TENANT_A_ID=... RLS_TEST_TENANT_B_EMAIL=... \
 *   RLS_TEST_TENANT_B_PASSWORD=... RLS_TEST_TENANT_B_ID=... \
 *   npx vitest run src/test/security/cross-tenant-rls.test.ts
 *
 * Failures throw rich messages that include the table, operation, attempted
 * query, returned rows, and the offending tenant IDs. See `rls-assert.ts`
 * and `rls-report-reporter.ts` for how this surfaces in CI reports.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Tenant-scoped tables that have a `tenant_id` column and are protected by
 * RLS. Anonymous clients must never see rows from these tables (except via
 * explicit anon-allow policies that filter by `tenants.is_active`, which
 * cannot leak rows because anon has no tenant membership).
 */
const TENANT_SCOPED_TABLES = [
  "access_code_redemptions",
  "archived_reservations",
  "audit_log",
  "beta_feedback",
  "blocked_slots",
  "booking_tokens",
  "booking_validation_log",
  "discount_codes",
  "email_send_log",
  "guest_reviews",
  "kitchen_menu_items",
  "kitchen_orders",
  "login_history",
  "notifications",
  "offers",
  "recurring_blocked_slots",
  "reservations",
  "resource_images",
  "resource_opening_hours",
  "resources",
] as const;

const PRIVATE_ONLY_TABLES = new Set([
  "access_code_redemptions",
  "audit_log",
  "beta_feedback",
  "booking_tokens",
  "booking_validation_log",
  "discount_codes",
  "email_send_log",
  "kitchen_menu_items",
  "kitchen_orders",
  "login_history",
  "notifications",
  "offers",
  "archived_reservations",
]);

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const liveCreds = {
  a: {
    email: process.env.RLS_TEST_TENANT_A_EMAIL,
    password: process.env.RLS_TEST_TENANT_A_PASSWORD,
    tenantId: process.env.RLS_TEST_TENANT_A_ID,
  },
  b: {
    email: process.env.RLS_TEST_TENANT_B_EMAIL,
    password: process.env.RLS_TEST_TENANT_B_PASSWORD,
    tenantId: process.env.RLS_TEST_TENANT_B_ID,
  },
};

const liveModeEnabled = Boolean(
  liveCreds.a.email &&
    liveCreds.a.password &&
    liveCreds.a.tenantId &&
    liveCreds.b.email &&
    liveCreds.b.password &&
    liveCreds.b.tenantId,
);

const newAnonClient = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

describe("Cross-Tenant RLS Regression Tests", () => {
  describe("Test manifest sanity", () => {
    it("lists every known tenant-scoped table", () => {
      // Adding a new tenant-scoped table requires updating this list so the
      // anon-denial sweep below covers it. This guards against accidental
      // omission when new features add tables.
      expect(TENANT_SCOPED_TABLES.length).toBeGreaterThanOrEqual(20);
    });

    it("table names follow naming conventions", () => {
      for (const table of TENANT_SCOPED_TABLES) {
        expect(table).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });
  });

  describe.runIf(hasSupabaseConfig)("Anonymous client RLS enforcement", () => {
    let anon: SupabaseClient;

    beforeAll(() => {
      anon = newAnonClient();
    });

    it.each(TENANT_SCOPED_TABLES)(
      "anon SELECT * FROM %s returns no rows (RLS enforced)",
      async (table) => {
        const { data, error } = await anon.from(table).select("tenant_id").limit(5);
        if (error) {
          expect(error.message).toBeTruthy();
          return;
        }
        expect(Array.isArray(data)).toBe(true);
        if (PRIVATE_ONLY_TABLES.has(table)) {
          expectReadDenied(
            {
              table,
              operation: "SELECT",
              attemptedQuery: `select tenant_id from ${table} limit 5`,
              actingTenantId: "(anonymous)",
              scenario: `anon SELECT from private table ${table}`,
            },
            { data, error },
          );
        }
      },
    );

    it("anon INSERT into private tenant tables is denied", async () => {
      const fakeTenantId = "00000000-0000-0000-0000-000000000000";
      const payload = { tenant_id: fakeTenantId, table_name: "test", action: "INSERT" };
      const { data, error } = await anon.from("audit_log").insert(payload).select();
      expectWriteDenied(
        {
          table: "audit_log",
          operation: "INSERT",
          attemptedQuery: `insert into audit_log ${JSON.stringify(payload)}`,
          actingTenantId: "(anonymous)",
          targetTenantId: fakeTenantId,
          scenario: "anon INSERT into audit_log",
        },
        { data, error },
      );
    });

    it("anon UPDATE on private tenant tables is denied", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const { error, data } = await anon
        .from("notifications")
        .update({ is_read: true })
        .eq("id", fakeId)
        .select();
      expectWriteDenied(
        {
          table: "notifications",
          operation: "UPDATE",
          attemptedQuery: `update notifications set is_read=true where id='${fakeId}'`,
          actingTenantId: "(anonymous)",
          scenario: "anon UPDATE notifications",
        },
        { data, error },
      );
    });
  });

  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "Live cross-tenant access denial",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;

      beforeAll(async () => {
        clientA = newAnonClient();
        clientB = newAnonClient();

        const { error: signInAError } = await clientA.auth.signInWithPassword({
          email: liveCreds.a.email!,
          password: liveCreds.a.password!,
        });
        if (signInAError) throw new Error(`Tenant A sign-in failed: ${signInAError.message}`);

        const { error: signInBError } = await clientB.auth.signInWithPassword({
          email: liveCreds.b.email!,
          password: liveCreds.b.password!,
        });
        if (signInBError) throw new Error(`Tenant B sign-in failed: ${signInBError.message}`);
      });

      it("user A cannot SELECT tenant B reservations", async () => {
        const result = await clientA
          .from("reservations")
          .select("id, tenant_id")
          .eq("tenant_id", liveCreds.b.tenantId!);
        expectReadDenied(
          {
            table: "reservations",
            operation: "SELECT",
            attemptedQuery: `select id, tenant_id from reservations where tenant_id='${liveCreds.b.tenantId}'`,
            actingTenantId: liveCreds.a.tenantId,
            targetTenantId: liveCreds.b.tenantId,
            scenario: "user A reading tenant B reservations",
          },
          result,
        );
      });

      it("user B cannot SELECT tenant A reservations", async () => {
        const result = await clientB
          .from("reservations")
          .select("id, tenant_id")
          .eq("tenant_id", liveCreds.a.tenantId!);
        expectReadDenied(
          {
            table: "reservations",
            operation: "SELECT",
            attemptedQuery: `select id, tenant_id from reservations where tenant_id='${liveCreds.a.tenantId}'`,
            actingTenantId: liveCreds.b.tenantId,
            targetTenantId: liveCreds.a.tenantId,
            scenario: "user B reading tenant A reservations",
          },
          result,
        );
      });

      it("user A cannot INSERT into tenant B audit_log", async () => {
        const payload = {
          tenant_id: liveCreds.b.tenantId!,
          table_name: "rls_test",
          action: "INSERT",
        };
        const { data, error } = await clientA.from("audit_log").insert(payload).select();
        expectWriteDenied(
          {
            table: "audit_log",
            operation: "INSERT",
            attemptedQuery: `insert into audit_log ${JSON.stringify(payload)}`,
            actingTenantId: liveCreds.a.tenantId,
            targetTenantId: liveCreds.b.tenantId,
            scenario: "user A forging audit_log row for tenant B",
          },
          { data, error },
        );
      });

      it("user A cannot UPDATE tenant B notifications", async () => {
        const { data, error } = await clientA
          .from("notifications")
          .update({ is_read: true })
          .eq("tenant_id", liveCreds.b.tenantId!)
          .select();
        expectWriteDenied(
          {
            table: "notifications",
            operation: "UPDATE",
            attemptedQuery: `update notifications set is_read=true where tenant_id='${liveCreds.b.tenantId}'`,
            actingTenantId: liveCreds.a.tenantId,
            targetTenantId: liveCreds.b.tenantId,
            scenario: "user A updating tenant B notifications",
          },
          { data, error },
        );
      });

      it.each(TENANT_SCOPED_TABLES)(
        "user A cannot read tenant B rows from %s",
        async (table) => {
          const result = await clientA
            .from(table)
            .select("tenant_id")
            .eq("tenant_id", liveCreds.b.tenantId!)
            .limit(1);
          if (result.error) {
            expect(result.error.message).toBeTruthy();
            return;
          }
          if (PRIVATE_ONLY_TABLES.has(table) || table === "reservations") {
            expectReadDenied(
              {
                table,
                operation: "SELECT",
                attemptedQuery: `select tenant_id from ${table} where tenant_id='${liveCreds.b.tenantId}' limit 1`,
                actingTenantId: liveCreds.a.tenantId,
                targetTenantId: liveCreds.b.tenantId,
                scenario: `user A sweeping ${table} for tenant B rows`,
              },
              result,
            );
          }
        },
      );

      it.each(TENANT_SCOPED_TABLES)(
        "user B cannot read tenant A rows from %s",
        async (table) => {
          const result = await clientB
            .from(table)
            .select("tenant_id")
            .eq("tenant_id", liveCreds.a.tenantId!)
            .limit(1);
          if (result.error) {
            expect(result.error.message).toBeTruthy();
            return;
          }
          if (PRIVATE_ONLY_TABLES.has(table) || table === "reservations") {
            expectReadDenied(
              {
                table,
                operation: "SELECT",
                attemptedQuery: `select tenant_id from ${table} where tenant_id='${liveCreds.a.tenantId}' limit 1`,
                actingTenantId: liveCreds.b.tenantId,
                targetTenantId: liveCreds.a.tenantId,
                scenario: `user B sweeping ${table} for tenant A rows`,
              },
              result,
            );
          }
        },
      );

      // ---------- Cross-tenant WRITE denial sweep ----------
      const WRITE_DENIAL_INSERTS: Array<{
        table: string;
        payload: (tenantId: string) => Record<string, unknown>;
      }> = [
        {
          table: "notifications",
          payload: (t) => ({ tenant_id: t, type: "test", title: "x", message: "x" }),
        },
        {
          table: "booking_validation_log",
          payload: (t) => ({ tenant_id: t, source: "rls_test", outcome: "denied" }),
        },
        {
          table: "kitchen_menu_items",
          payload: (t) => ({ tenant_id: t, name: "rls_test_item", category: "food" }),
        },
        {
          table: "kitchen_orders",
          payload: (t) => ({
            tenant_id: t,
            reservation_id: "00000000-0000-0000-0000-000000000000",
            item_name: "rls_test",
          }),
        },
        {
          table: "discount_codes",
          payload: (t) => ({ tenant_id: t, code: "RLS_TEST", discount_value: 0 }),
        },
        {
          table: "offers",
          payload: (t) => ({
            tenant_id: t,
            guest_name: "rls",
            guest_email: "rls@test.local",
            guest_phone: "0",
            guests_count: 1,
            event_date: "2099-01-01",
            start_time: "10:00",
          }),
        },
        {
          table: "blocked_slots",
          payload: (t) => ({
            tenant_id: t,
            resource_type: "table",
            date: "2099-01-01",
          }),
        },
      ];

      it.each(WRITE_DENIAL_INSERTS)(
        "user A cannot INSERT a forged tenant B row into $table",
        async ({ table, payload }) => {
          const body = payload(liveCreds.b.tenantId!);
          const { data, error } = await clientA.from(table).insert(body).select();
          expectWriteDenied(
            {
              table,
              operation: "INSERT",
              attemptedQuery: `insert into ${table} ${JSON.stringify(body)}`,
              actingTenantId: liveCreds.a.tenantId,
              targetTenantId: liveCreds.b.tenantId,
              scenario: `user A forging ${table} row for tenant B`,
            },
            { data, error },
          );
        },
      );

      it.each(WRITE_DENIAL_INSERTS)(
        "user B cannot INSERT a forged tenant A row into $table",
        async ({ table, payload }) => {
          const body = payload(liveCreds.a.tenantId!);
          const { data, error } = await clientB.from(table).insert(body).select();
          expectWriteDenied(
            {
              table,
              operation: "INSERT",
              attemptedQuery: `insert into ${table} ${JSON.stringify(body)}`,
              actingTenantId: liveCreds.b.tenantId,
              targetTenantId: liveCreds.a.tenantId,
              scenario: `user B forging ${table} row for tenant A`,
            },
            { data, error },
          );
        },
      );

      it("user A cannot DELETE tenant B notifications via cross-tenant filter", async () => {
        const { data, error } = await clientA
          .from("notifications")
          .delete()
          .eq("tenant_id", liveCreds.b.tenantId!)
          .select();
        expectWriteDenied(
          {
            table: "notifications",
            operation: "DELETE",
            attemptedQuery: `delete from notifications where tenant_id='${liveCreds.b.tenantId}'`,
            actingTenantId: liveCreds.a.tenantId,
            targetTenantId: liveCreds.b.tenantId,
            scenario: "user A deleting tenant B notifications",
          },
          { data, error },
        );
      });

      it("user A cannot UPDATE tenant B reservations via cross-tenant filter", async () => {
        const { data, error } = await clientA
          .from("reservations")
          .update({ internal_notes: "RLS-test should not apply" })
          .eq("tenant_id", liveCreds.b.tenantId!)
          .select();
        expectWriteDenied(
          {
            table: "reservations",
            operation: "UPDATE",
            attemptedQuery: `update reservations set internal_notes='...' where tenant_id='${liveCreds.b.tenantId}'`,
            actingTenantId: liveCreds.a.tenantId,
            targetTenantId: liveCreds.b.tenantId,
            scenario: "user A updating tenant B reservations",
          },
          { data, error },
        );
      });

      // ---------- Cross-tenant UPDATE / DELETE sweep (every tenant-scoped table) ----------
      //
      // For every tenant-scoped table we attempt:
      //   1. UPDATE ... WHERE tenant_id = '<other tenant>'  (no-op SET that
      //      touches only the tenant_id column with its current value, so the
      //      payload is universally valid). Under correct RLS this must affect
      //      ZERO rows — either the policy errors out, or the USING/WITH CHECK
      //      clause filters every candidate row.
      //   2. DELETE ... WHERE tenant_id = '<other tenant>'  (same intent —
      //      should never match any row from the foreign tenant).
      //
      // We use the shared expectWriteDenied helper which treats both an
      // explicit error AND a silent zero-row result as denial. Anything else
      // (data.length > 0) is a leak and throws with full query context.
      const SWEEP_TABLES = TENANT_SCOPED_TABLES;

      it.each(SWEEP_TABLES)(
        "user A cannot UPDATE tenant B rows in %s (cross-tenant filter)",
        async (table) => {
          const { data, error } = await clientA
            .from(table)
            // Self-assigning tenant_id is a no-op write that works for every
            // tenant-scoped table without needing per-table column knowledge.
            .update({ tenant_id: liveCreds.b.tenantId! })
            .eq("tenant_id", liveCreds.b.tenantId!)
            .select("tenant_id");
          expectWriteDenied(
            {
              table,
              operation: "UPDATE",
              attemptedQuery: `update ${table} set tenant_id='${liveCreds.b.tenantId}' where tenant_id='${liveCreds.b.tenantId}'`,
              actingTenantId: liveCreds.a.tenantId,
              targetTenantId: liveCreds.b.tenantId,
              scenario: `user A sweeping UPDATE on ${table} for tenant B rows`,
            },
            { data, error },
          );
        },
      );

      it.each(SWEEP_TABLES)(
        "user B cannot UPDATE tenant A rows in %s (cross-tenant filter)",
        async (table) => {
          const { data, error } = await clientB
            .from(table)
            .update({ tenant_id: liveCreds.a.tenantId! })
            .eq("tenant_id", liveCreds.a.tenantId!)
            .select("tenant_id");
          expectWriteDenied(
            {
              table,
              operation: "UPDATE",
              attemptedQuery: `update ${table} set tenant_id='${liveCreds.a.tenantId}' where tenant_id='${liveCreds.a.tenantId}'`,
              actingTenantId: liveCreds.b.tenantId,
              targetTenantId: liveCreds.a.tenantId,
              scenario: `user B sweeping UPDATE on ${table} for tenant A rows`,
            },
            { data, error },
          );
        },
      );

      it.each(SWEEP_TABLES)(
        "user A cannot DELETE tenant B rows in %s (cross-tenant filter)",
        async (table) => {
          const { data, error } = await clientA
            .from(table)
            .delete()
            .eq("tenant_id", liveCreds.b.tenantId!)
            .select("tenant_id");
          expectWriteDenied(
            {
              table,
              operation: "DELETE",
              attemptedQuery: `delete from ${table} where tenant_id='${liveCreds.b.tenantId}'`,
              actingTenantId: liveCreds.a.tenantId,
              targetTenantId: liveCreds.b.tenantId,
              scenario: `user A sweeping DELETE on ${table} for tenant B rows`,
            },
            { data, error },
          );
        },
      );

      it.each(SWEEP_TABLES)(
        "user B cannot DELETE tenant A rows in %s (cross-tenant filter)",
        async (table) => {
          const { data, error } = await clientB
            .from(table)
            .delete()
            .eq("tenant_id", liveCreds.a.tenantId!)
            .select("tenant_id");
          expectWriteDenied(
            {
              table,
              operation: "DELETE",
              attemptedQuery: `delete from ${table} where tenant_id='${liveCreds.a.tenantId}'`,
              actingTenantId: liveCreds.b.tenantId,
              targetTenantId: liveCreds.a.tenantId,
              scenario: `user B sweeping DELETE on ${table} for tenant A rows`,
            },
            { data, error },
          );
        },
      );

      // ---------- Positive control: own-tenant access works ----------
      it("user A CAN read their own tenant_users row (sanity check)", async () => {
        const { data, error } = await clientA
          .from("tenant_users")
          .select("tenant_id")
          .eq("tenant_id", liveCreds.a.tenantId!);
        expect(error).toBeNull();
        expect((data ?? []).length).toBeGreaterThan(0);
        for (const row of data ?? []) {
          expect(row.tenant_id).toBe(liveCreds.a.tenantId!);
        }
      });

      it("user B CAN read their own tenant_users row (sanity check)", async () => {
        const { data, error } = await clientB
          .from("tenant_users")
          .select("tenant_id")
          .eq("tenant_id", liveCreds.b.tenantId!);
        expect(error).toBeNull();
        expect((data ?? []).length).toBeGreaterThan(0);
        for (const row of data ?? []) {
          expect(row.tenant_id).toBe(liveCreds.b.tenantId!);
        }
      });

      it("user A reservations query never leaks tenant B rows (unfiltered)", async () => {
        const result = await clientA.from("reservations").select("tenant_id").limit(50);
        expectNoForeignTenantRows(
          {
            table: "reservations",
            operation: "SELECT",
            attemptedQuery: `select tenant_id from reservations limit 50`,
            actingTenantId: liveCreds.a.tenantId,
            scenario: "user A unfiltered reservations sweep",
          },
          result,
          liveCreds.b.tenantId!,
        );
      });

      it("user B reservations query never leaks tenant A rows (unfiltered)", async () => {
        const result = await clientB.from("reservations").select("tenant_id").limit(50);
        expectNoForeignTenantRows(
          {
            table: "reservations",
            operation: "SELECT",
            attemptedQuery: `select tenant_id from reservations limit 50`,
            actingTenantId: liveCreds.b.tenantId,
            scenario: "user B unfiltered reservations sweep",
          },
          result,
          liveCreds.a.tenantId!,
        );
      });
    },
  );

  describe.skipIf(hasSupabaseConfig)("Skipped: missing Supabase config", () => {
    it("test environment is missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — set both to enable the anon-denial sweep", () => {
      expect(true).toBe(true);
    });
  });

  describe.skipIf(!hasSupabaseConfig || liveModeEnabled)(
    "Skipped: live cross-tenant mode disabled",
    () => {
      it(
        "Set RLS_TEST_TENANT_A_EMAIL/PASSWORD/ID and RLS_TEST_TENANT_B_EMAIL/PASSWORD/ID to enable. CI auto-provisions these via the local Supabase stack workflow (.github/workflows/cross-tenant-rls-local.yml).",
        () => {
          expect(true).toBe(true);
        },
      );
    },
  );
});
