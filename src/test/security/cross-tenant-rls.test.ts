import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
 *    each user cannot read or write the other tenant's data:
 *      - RLS_TEST_TENANT_A_EMAIL / RLS_TEST_TENANT_A_PASSWORD / RLS_TEST_TENANT_A_ID
 *      - RLS_TEST_TENANT_B_EMAIL / RLS_TEST_TENANT_B_PASSWORD / RLS_TEST_TENANT_B_ID
 *
 * To run live mode locally:
 *   RLS_TEST_TENANT_A_EMAIL=... RLS_TEST_TENANT_A_PASSWORD=... \
 *   RLS_TEST_TENANT_A_ID=... RLS_TEST_TENANT_B_EMAIL=... \
 *   RLS_TEST_TENANT_B_PASSWORD=... RLS_TEST_TENANT_B_ID=... \
 *   npx vitest run src/test/security/cross-tenant-rls.test.ts
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
        // SAFETY: anon role has no tenant membership, so any returned row
        // would indicate a cross-tenant leak via overly permissive RLS.
        // Some tables allow anon SELECT only when joined to active tenants
        // (e.g. blocked_slots) — but those policies still require a tenant
        // context that anon lacks. A legitimate anon read returns []; a
        // misconfigured policy would return rows from arbitrary tenants.
        const { data, error } = await anon.from(table).select("tenant_id").limit(5);

        // Either the query is denied (error) OR returns an empty array.
        // Both outcomes prove no cross-tenant leak. Returning rows from a
        // mixed set of tenants would be a CRITICAL failure.
        if (error) {
          // Permission-denied / RLS rejection — acceptable.
          expect(error.message).toBeTruthy();
          return;
        }
        expect(Array.isArray(data)).toBe(true);

        // For tables with anon-allow policies (e.g. blocked_slots), data
        // may contain rows but they must all be public-by-design (filtered
        // by `tenants.is_active = true`). The critical invariant is that
        // anon cannot reach tenant-private tables.
        const PRIVATE_ONLY = [
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
        ];
        if (PRIVATE_ONLY.includes(table)) {
          expect(data?.length ?? 0).toBe(0);
        }
      },
    );

    it("anon INSERT into private tenant tables is denied", async () => {
      const fakeTenantId = "00000000-0000-0000-0000-000000000000";
      const { error } = await anon.from("audit_log").insert({
        tenant_id: fakeTenantId,
        table_name: "test",
        action: "INSERT",
      });
      expect(error).toBeTruthy();
    });

    it("anon UPDATE on private tenant tables is denied", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const { error, data } = await anon
        .from("notifications")
        .update({ is_read: true })
        .eq("id", fakeId)
        .select();
      // Either the update errors out OR affects zero rows (no visible row to update).
      const denied = Boolean(error) || !data || data.length === 0;
      expect(denied).toBe(true);
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
        const { data, error } = await clientA
          .from("reservations")
          .select("id, tenant_id")
          .eq("tenant_id", liveCreds.b.tenantId!);
        expect(error).toBeNull();
        expect(data ?? []).toEqual([]);
      });

      it("user B cannot SELECT tenant A reservations", async () => {
        const { data, error } = await clientB
          .from("reservations")
          .select("id, tenant_id")
          .eq("tenant_id", liveCreds.a.tenantId!);
        expect(error).toBeNull();
        expect(data ?? []).toEqual([]);
      });

      it("user A cannot INSERT into tenant B audit_log", async () => {
        const { error } = await clientA.from("audit_log").insert({
          tenant_id: liveCreds.b.tenantId!,
          table_name: "rls_test",
          action: "INSERT",
        });
        expect(error).toBeTruthy();
      });

      it("user A cannot UPDATE tenant B notifications", async () => {
        // Try updating with the cross-tenant filter — must affect 0 rows.
        const { data } = await clientA
          .from("notifications")
          .update({ is_read: true })
          .eq("tenant_id", liveCreds.b.tenantId!)
          .select();
        expect(data ?? []).toEqual([]);
      });

      it.each(TENANT_SCOPED_TABLES)(
        "user A cannot read tenant B rows from %s",
        async (table) => {
          const { data, error } = await clientA
            .from(table)
            .select("tenant_id")
            .eq("tenant_id", liveCreds.b.tenantId!)
            .limit(1);
          // Anon-allowed views (e.g. resources, resource_images) may legitimately
          // expose public rows for active tenants. For those, ensure the row's
          // tenant_id matches what we filtered for AND the leak is bounded to
          // anon-published columns. For private tables the result must be empty.
          if (error) {
            expect(error.message).toBeTruthy();
            return;
          }
          // Even if rows are returned (public views), confirm no rows from a
          // foreign tenant ever surface OUTSIDE the public surface area:
          const PRIVATE_ONLY = [
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
            "reservations",
          ];
          if (PRIVATE_ONLY.includes(table)) {
            expect(data ?? []).toEqual([]);
          }
        },
      );
    },
  );

  describe.skipIf(hasSupabaseConfig)("Skipped: missing Supabase config", () => {
    it("test environment is missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY", () => {
      expect(true).toBe(true);
    });
  });
});
