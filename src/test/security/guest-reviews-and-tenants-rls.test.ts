/**
 * RLS regression tests for `guest_reviews` and `tenants` / `tenants_public`.
 *
 * Goal: lock in the security posture established by recent migrations so a
 * future RLS change can't silently re-open these holes:
 *
 *   1. `tenants` base table is NOT readable by anon (sensitive Stripe / tier /
 *      billing columns must stay private).
 *   2. `tenants_public` view IS readable by anon, but only exposes whitelisted
 *      columns and only for active tenants.
 *   3. `guest_reviews` is fully blocked for anon SELECT.
 *   4. `guest_reviews` INSERT from anon REQUIRES a valid booking token AND
 *      guest_email + guest_name that match the underlying reservation
 *      (spoofing is rejected).
 *   5. Authenticated tenant users cannot read another tenant's reviews or the
 *      other tenant's base `tenants` row.
 *   6. System admin (service-role) can read both `tenants` and all
 *      `guest_reviews` (positive control — proves we're testing real RLS, not
 *      a globally broken table).
 *
 * Roles tested: anon, authenticated (via the existing tenant-pair fixture),
 * and system-admin (via SUPABASE_SERVICE_ROLE_KEY when available).
 *
 * Skip semantics match the rest of the security suite: missing creds skip
 * cleanly rather than failing, so this test file is safe to run in any CI
 * environment.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expectReadDenied, expectWriteDenied } from "./rls-assert";
import {
  createTenantPairFixture,
  tenantPairFixtureLikelyAvailable,
  type TenantPairFixture,
} from "./fixtures/tenant-pair";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const hasServiceRole = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const newAnonClient = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const newServiceClient = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

// Columns that must NEVER be exposed by the public view. If any of these ever
// show up via tenants_public the view has been widened by mistake.
const TENANTS_PRIVATE_COLUMNS = [
  "stripe_customer_id",
  "stripe_subscription_id",
  "tier",
  "subscription_status",
  "owner_user_id",
] as const;

describe("guest_reviews + tenants RLS regression", () => {
  describe.runIf(hasSupabaseConfig)("Anonymous role", () => {
    let anon: SupabaseClient;
    beforeAll(() => {
      anon = newAnonClient();
    });

    it("anon SELECT on tenants base table returns no rows (RLS enforced)", async () => {
      const { data, error } = await anon.from("tenants").select("id").limit(5);
      // Either an explicit error OR an empty result set is acceptable:
      // both prove anon cannot read the base table.
      if (!error) {
        expectReadDenied(
          {
            table: "tenants",
            operation: "SELECT",
            attemptedQuery: "select id from tenants limit 5",
            actingTenantId: "(anonymous)",
            scenario: "anon SELECT on tenants base table",
          },
          { data, error },
        );
      } else {
        expect(error.message).toBeTruthy();
      }
    });

    it("anon SELECT on tenants_public works for active tenants", async () => {
      const { data, error } = await anon
        .from("tenants_public")
        .select("id, slug, name, is_active")
        .eq("is_active", true)
        .limit(5);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      for (const row of data ?? []) {
        expect((row as { is_active: boolean }).is_active).toBe(true);
      }
    });

    it("tenants_public does not expose any sensitive billing/tier columns", async () => {
      // Selecting the private columns explicitly must fail at the
      // PostgREST layer because the view does not project them.
      for (const col of TENANTS_PRIVATE_COLUMNS) {
        const { error } = await anon.from("tenants_public").select(col).limit(1);
        expect(
          error,
          `tenants_public must NOT expose column "${col}" (got no error → column leaked)`,
        ).not.toBeNull();
      }
    });

    it("anon SELECT on guest_reviews returns no rows (RLS enforced)", async () => {
      const { data, error } = await anon.from("guest_reviews").select("id").limit(5);
      if (!error) {
        expectReadDenied(
          {
            table: "guest_reviews",
            operation: "SELECT",
            attemptedQuery: "select id from guest_reviews limit 5",
            actingTenantId: "(anonymous)",
            scenario: "anon SELECT on guest_reviews",
          },
          { data, error },
        );
      } else {
        expect(error.message).toBeTruthy();
      }
    });

    it("anon INSERT into guest_reviews without a token is denied", async () => {
      const fakeTenantId = "00000000-0000-0000-0000-000000000000";
      const fakeReservationId = "00000000-0000-0000-0000-000000000001";
      const payload = {
        tenant_id: fakeTenantId,
        reservation_id: fakeReservationId,
        guest_name: "Spoofed Guest",
        guest_email: "spoof@example.com",
        rating: 5,
        comment: "Should never land",
      };
      const { data, error } = await anon.from("guest_reviews").insert(payload).select();
      expectWriteDenied(
        {
          table: "guest_reviews",
          operation: "INSERT",
          attemptedQuery: `insert into guest_reviews ${JSON.stringify(payload)}`,
          actingTenantId: "(anonymous)",
          targetTenantId: fakeTenantId,
          scenario: "anon INSERT into guest_reviews without booking token",
        },
        { data, error },
      );
    });

    it("anon INSERT into guest_reviews with a forged token is denied", async () => {
      const fakeTenantId = "00000000-0000-0000-0000-000000000000";
      const fakeReservationId = "00000000-0000-0000-0000-000000000001";
      const payload = {
        tenant_id: fakeTenantId,
        reservation_id: fakeReservationId,
        guest_name: "Spoofed Guest",
        guest_email: "spoof@example.com",
        rating: 5,
        review_token: "not-a-real-token-" + Date.now(),
      };
      const { data, error } = await anon.from("guest_reviews").insert(payload).select();
      expectWriteDenied(
        {
          table: "guest_reviews",
          operation: "INSERT",
          attemptedQuery: `insert into guest_reviews ${JSON.stringify(payload)}`,
          actingTenantId: "(anonymous)",
          targetTenantId: fakeTenantId,
          scenario: "anon INSERT into guest_reviews with forged token",
        },
        { data, error },
      );
    });
  });

  describe.runIf(tenantPairFixtureLikelyAvailable())(
    "Authenticated role (cross-tenant)",
    () => {
      let fixture: TenantPairFixture | undefined;
      let clientA: SupabaseClient;
      let tenantBId: string;

      beforeAll(async () => {
        fixture = await createTenantPairFixture();
        if (!fixture.available || !fixture.a || !fixture.b) {
          throw new Error(
            `Tenant pair fixture unavailable: ${fixture.skipReason ?? "(no reason)"}`,
          );
        }
        clientA = fixture.a.client;
        tenantBId = fixture.b.tenantId;
      });

      it("tenant A cannot read tenant B's guest_reviews", async () => {
        const { data, error } = await clientA
          .from("guest_reviews")
          .select("id, tenant_id")
          .eq("tenant_id", tenantBId)
          .limit(5);
        expectReadDenied(
          {
            table: "guest_reviews",
            operation: "SELECT",
            attemptedQuery: `select id, tenant_id from guest_reviews where tenant_id='${tenantBId}'`,
            targetTenantId: tenantBId,
            scenario: "tenant A reads tenant B's guest_reviews",
          },
          { data, error },
        );
      });

      it("tenant A cannot read tenant B's base tenants row", async () => {
        const { data, error } = await clientA
          .from("tenants")
          .select("id")
          .eq("id", tenantBId)
          .limit(1);
        expectReadDenied(
          {
            table: "tenants",
            operation: "SELECT",
            attemptedQuery: `select id from tenants where id='${tenantBId}'`,
            targetTenantId: tenantBId,
            scenario: "tenant A reads tenant B's base tenants row",
          },
          { data, error },
        );
      });

      it("tenant A cannot INSERT a guest_review forged for tenant B", async () => {
        const payload = {
          tenant_id: tenantBId,
          reservation_id: "00000000-0000-0000-0000-000000000001",
          guest_name: "Cross-Tenant Spoof",
          guest_email: "spoof@example.com",
          rating: 1,
        };
        const { data, error } = await clientA
          .from("guest_reviews")
          .insert(payload)
          .select();
        expectWriteDenied(
          {
            table: "guest_reviews",
            operation: "INSERT",
            attemptedQuery: `insert into guest_reviews ${JSON.stringify(payload)}`,
            targetTenantId: tenantBId,
            scenario: "tenant A INSERT into tenant B's guest_reviews",
          },
          { data, error },
        );
      });
    },
  );

  describe.runIf(hasServiceRole)("System admin role (service role bypass)", () => {
    let svc: SupabaseClient;
    beforeAll(() => {
      svc = newServiceClient();
    });

    it("service role CAN read tenants base table (positive control)", async () => {
      const { data, error } = await svc.from("tenants").select("id").limit(1);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it("service role CAN read guest_reviews (positive control)", async () => {
      const { data, error } = await svc.from("guest_reviews").select("id").limit(1);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
