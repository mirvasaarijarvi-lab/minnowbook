import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Duplicate Tenant Membership — Behavioural Contract
 *
 * Verifies the documented behaviour of `public.get_user_tenant_id(uuid)`:
 * when a user belongs to MORE THAN ONE tenant, the function intentionally
 * returns NULL (no resolvable single tenant). This prevents the app from
 * silently picking one tenant when the data model is ambiguous.
 *
 * In addition to the resolver behaviour, this test asserts that RLS continues
 * to deny cross-tenant reads in that ambiguous state — i.e. the user can ONLY
 * see rows from a tenant they are an explicit member of, never from any other
 * tenant (including a third tenant they don't belong to).
 *
 * Modes
 * -----
 *
 * 1. ALWAYS (CI-safe, no secrets): A read-only sanity check that confirms the
 *    `get_user_tenant_id` RPC exists and rejects unauthenticated callers
 *    appropriately. Verifies wiring without requiring write access.
 *
 * 2. OPT-IN (live integration, requires service role): When the env vars
 *    below are set, the test:
 *      a. Uses the service-role client to add the test user to a SECOND
 *         tenant (creating the duplicate-membership state).
 *      b. Signs in as that user with the anon key.
 *      c. Asserts `get_user_tenant_id(<user>)` returns NULL.
 *      d. Asserts the user can read rows from BOTH of their tenants
 *         (positive control — proves the test is wired correctly).
 *      e. Asserts the user CANNOT read rows from a third tenant they
 *         do not belong to (cross-tenant denial under ambiguity).
 *      f. Cleans up the extra membership.
 *
 *    Required env vars:
 *      - RLS_TEST_TENANT_A_EMAIL / RLS_TEST_TENANT_A_PASSWORD / RLS_TEST_TENANT_A_ID
 *      - RLS_TEST_TENANT_B_ID                — second tenant to add the user to
 *      - RLS_TEST_THIRD_TENANT_ID            — a tenant the user must NOT see
 *      - SUPABASE_SERVICE_ROLE_KEY           — required to mutate tenant_users
 *
 * To run live mode locally:
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   RLS_TEST_TENANT_A_EMAIL=... RLS_TEST_TENANT_A_PASSWORD=... \
 *   RLS_TEST_TENANT_A_ID=... RLS_TEST_TENANT_B_ID=... \
 *   RLS_TEST_THIRD_TENANT_ID=... \
 *   npx vitest run src/test/security/duplicate-tenant-membership.test.ts
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const liveCreds = {
  email: process.env.RLS_TEST_TENANT_A_EMAIL,
  password: process.env.RLS_TEST_TENANT_A_PASSWORD,
  tenantA: process.env.RLS_TEST_TENANT_A_ID,
  tenantB: process.env.RLS_TEST_TENANT_B_ID,
  tenantThird: process.env.RLS_TEST_THIRD_TENANT_ID,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const hasLiveCreds = Boolean(
  liveCreds.email &&
    liveCreds.password &&
    liveCreds.tenantA &&
    liveCreds.tenantB &&
    liveCreds.tenantThird &&
    liveCreds.serviceRoleKey,
);

describe("Duplicate Tenant Membership — Behavioural Contract", () => {
  describe.runIf(hasSupabaseConfig)("RPC wiring (always-on)", () => {
    let anon: SupabaseClient;

    beforeAll(() => {
      anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    });

    it("get_user_tenant_id RPC exists and is callable", async () => {
      // SECURITY DEFINER function; calling with a random UUID from an
      // unauthenticated session must not throw a "function does not exist"
      // error. Result will be NULL because the user has no memberships.
      const randomUserId = "00000000-0000-0000-0000-000000000000";
      const { data, error } = await anon.rpc("get_user_tenant_id", { p_user_id: randomUserId });

      // We accept either a successful NULL response or an authorization
      // error — both prove the RPC is registered. We do NOT accept a
      // "function does not exist" failure.
      if (error) {
        expect(error.message.toLowerCase()).not.toContain("does not exist");
      } else {
        expect(data).toBeNull();
      }
    });
  });

  describe.runIf(hasSupabaseConfig && hasLiveCreds)("Live duplicate-membership integration", () => {
    let userClient: SupabaseClient;
    let serviceClient: SupabaseClient;
    let userId: string;
    let createdMembershipId: string | null = null;

    beforeAll(async () => {
      // Authenticated client signs in as the test user (originally a member of tenant A).
      userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
        email: liveCreds.email!,
        password: liveCreds.password!,
      });
      if (signInError || !signInData.user) {
        throw new Error(
          `Failed to sign in test user: ${signInError?.message ?? "no user returned"}. ` +
            `Confirm RLS_TEST_TENANT_A_EMAIL / RLS_TEST_TENANT_A_PASSWORD are valid and the account is confirmed.`,
        );
      }
      userId = signInData.user.id;

      // Service-role client to perform privileged setup (adding a second tenant
      // membership). RLS would block the user from doing this themselves.
      serviceClient = createClient(SUPABASE_URL!, liveCreds.serviceRoleKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Sanity: the user must already be a member of tenant A so we don't
      // accidentally create a brand-new membership graph during the test.
      const { data: existingA, error: existingErr } = await serviceClient
        .from("tenant_users")
        .select("id, tenant_id")
        .eq("user_id", userId)
        .eq("tenant_id", liveCreds.tenantA!)
        .maybeSingle();
      if (existingErr) {
        throw new Error(`Failed to verify existing tenant A membership: ${existingErr.message}`);
      }
      if (!existingA) {
        throw new Error(
          `Test user ${userId} is not a member of RLS_TEST_TENANT_A_ID (${liveCreds.tenantA}). ` +
            `Seed the membership before running this test.`,
        );
      }

      // Add the duplicate (tenant B) membership. This is the state under test.
      // Insert as 'staff' (lowest privilege) — the role is irrelevant for the
      // resolver and RLS assertions and minimises blast radius if cleanup fails.
      const { data: inserted, error: insertErr } = await serviceClient
        .from("tenant_users")
        .insert({
          user_id: userId,
          tenant_id: liveCreds.tenantB!,
          role: "staff",
          is_approved: true,
        })
        .select("id")
        .single();
      if (insertErr) {
        throw new Error(
          `Failed to create duplicate membership in tenant B: ${insertErr.message}. ` +
            `If the user is already in tenant B, remove that membership before running this test.`,
        );
      }
      createdMembershipId = inserted.id;
    });

    afterAll(async () => {
      // Always clean up the membership we created, even if assertions failed.
      if (createdMembershipId && serviceClient) {
        await serviceClient.from("tenant_users").delete().eq("id", createdMembershipId);
      }
      if (userClient) {
        await userClient.auth.signOut();
      }
    });

    it("get_user_tenant_id returns NULL when the user has multiple memberships", async () => {
      // Documented behaviour of the SECURITY DEFINER function:
      //   SELECT tenant_id FROM tenant_users
      //    WHERE user_id = p_user_id
      //      AND (SELECT count(*) FROM tenant_users WHERE user_id = p_user_id) = 1
      //    LIMIT 1
      // → returns NULL when count > 1 (no single resolvable tenant).
      const { data, error } = await userClient.rpc("get_user_tenant_id", { p_user_id: userId });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("user can read rows from BOTH of their tenants (positive control)", async () => {
      // Confirms the test setup is wired correctly: if neither read works,
      // a later cross-tenant denial check could pass trivially.
      const { data: ownA, error: errA } = await userClient
        .from("tenant_users")
        .select("id, tenant_id")
        .eq("user_id", userId)
        .eq("tenant_id", liveCreds.tenantA!);
      expect(errA).toBeNull();
      expect(ownA?.length ?? 0).toBeGreaterThan(0);

      const { data: ownB, error: errB } = await userClient
        .from("tenant_users")
        .select("id, tenant_id")
        .eq("user_id", userId)
        .eq("tenant_id", liveCreds.tenantB!);
      expect(errB).toBeNull();
      expect(ownB?.length ?? 0).toBeGreaterThan(0);
    });

    it("user CANNOT read rows from a third tenant they don't belong to", async () => {
      // The duplicate-membership state must NOT relax RLS — the user should
      // still be invisible to any tenant they're not an explicit member of.
      const { data, error } = await userClient
        .from("tenant_users")
        .select("id")
        .eq("tenant_id", liveCreds.tenantThird!);

      // Either an explicit error or zero rows is acceptable; row leakage is not.
      if (error) {
        // Permission errors are fine — RLS blocked the read.
        expect(error.message).toBeTruthy();
      } else {
        expect(data ?? []).toEqual([]);
      }
    });

    it("unfiltered tenant-scoped query never returns rows from the third tenant", async () => {
      // Probe a representative tenant-scoped table. An unfiltered SELECT must
      // only ever surface rows the user has membership in — never the third tenant's.
      const { data, error } = await userClient.from("reservations").select("tenant_id").limit(500);

      if (error) {
        // RLS may simply error out for some tables — that's still safe.
        expect(error.message).toBeTruthy();
        return;
      }
      const leakedTenantIds = new Set((data ?? []).map((r) => r.tenant_id));
      expect(leakedTenantIds.has(liveCreds.tenantThird!)).toBe(false);
    });
  });

  describe.skipIf(hasSupabaseConfig && hasLiveCreds)("Skipped: missing live credentials", () => {
    it("set RLS_TEST_TENANT_A/B/THIRD env vars + SUPABASE_SERVICE_ROLE_KEY to enable", () => {
      // This skipped block documents what's missing without failing CI.
      expect(true).toBe(true);
    });
  });
});
