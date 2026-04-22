/**
 * Integration test for the `/superadmin` forbidden flow's audit trail.
 *
 * Contract under test (end-to-end):
 *
 *   1. A non-system-admin user invokes the `log-forbidden-access` edge
 *      function with a JWT and an attempted-area payload.
 *   2. The function resolves the caller's user_id from the JWT and the
 *      tenant_id from `tenant_users` (single-tenant lookup).
 *   3. It inserts exactly one row into `audit_log` with:
 *        - action      = 'forbidden_access'
 *        - user_id     = the JWT's user (NEVER a client-supplied id)
 *        - tenant_id   = the user's actual tenant
 *        - table_name  = 'auth_routes'
 *        - new_data    = { attempted_area, attempted_path, ... }
 *        - created_at  = a server-set timestamp close to "now"
 *
 * The audit row is the only durable record that a denial happened, so
 * if any of those fields drift, security review and tenant-owner
 * visibility silently break. This test fails loudly if they do.
 *
 * ## Why service-role for verification
 *
 * The test reads `audit_log` back with the service-role client because
 * the table's RLS policy only lets owners/admins of the *same tenant*
 * read their own rows. Using the user's own client would muddle "did
 * the row get written?" with "does the policy let me see it?". The
 * service-role read isolates the write-side contract.
 *
 * ## Why this is gated, not skipped silently
 *
 * The fixture refuses to run without either explicit
 * RLS_TEST_TENANT_A/B credentials or a SUPABASE_SERVICE_ROLE_KEY for
 * auto-provisioning. In CI, the `cross-tenant-rls-local` workflow
 * provides the service role; locally, developers either have it
 * exported or the test is marked skipped. A skip is preferred over a
 * false pass — when the fixture is gone, that's a CI plumbing bug.
 *
 * ## Throttle interaction
 *
 * The function has an in-memory throttle (default 60s, see
 * FORBIDDEN_LOG_THROTTLE_SECONDS in the function source). To avoid
 * cross-test interference we use a unique attemptedArea slug per test
 * run so the (user, area) throttle key is fresh on each invocation —
 * the throttle only collapses *repeats*, not first-time entries.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createTenantPairFixture,
  tenantPairFixtureLikelyAvailable,
  tenantPairFixtureSkipReason,
  type TenantPairFixture,
} from "./fixtures/tenant-pair";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// We need the service role to read audit_log back regardless of which
// auth mode the fixture used (env-creds users may not be system admins
// either, so authenticated reads can't see the cross-tenant view).
const canRunFully =
  tenantPairFixtureLikelyAvailable() &&
  Boolean(SUPABASE_URL) &&
  Boolean(SERVICE_ROLE_KEY);

const skipReason = !canRunFully
  ? `Skipping forbidden-access audit integration test: ${
      !SERVICE_ROLE_KEY
        ? "SUPABASE_SERVICE_ROLE_KEY required to verify audit_log writes"
        : (tenantPairFixtureSkipReason() ?? "tenant fixture unavailable")
    }`
  : null;

describe.runIf(canRunFully)(
  "log-forbidden-access writes audit_log row attributed to the JWT user",
  () => {
    let fixture: TenantPairFixture;
    let admin: SupabaseClient;
    // Insertions made during the test that we want to clean up afterwards,
    // keyed by audit_log id. Best-effort — if cleanup fails we log it but
    // don't fail the test, since the production cleanup_old_audit_logs job
    // sweeps these eventually.
    const createdRowIds = new Set<string>();

    beforeAll(async () => {
      fixture = await createTenantPairFixture();
      if (!fixture.available || !fixture.a) {
        throw new Error(
          `Fixture reported available, but setup failed: ${fixture.skipReason ?? "unknown"}`,
        );
      }
      admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    });

    afterAll(async () => {
      if (!admin || createdRowIds.size === 0) return;
      // We bypass RLS with the service role for cleanup. Failing to clean
      // up is non-fatal — the rows are real audit entries and harmless.
      const ids = Array.from(createdRowIds);
      const { error } = await admin.from("audit_log").delete().in("id", ids);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(
          `[forbidden-access-audit] cleanup of ${ids.length} audit rows failed:`,
          error.message,
        );
      }
    });

    it(
      "persists a row with action='forbidden_access', the caller's user_id, and a server timestamp",
      async () => {
        const tenantA = fixture.a!;

        // Use a unique slug so the function's per-(user, area) throttle
        // never collides with a previous run within the cooldown window.
        const uniqueArea = `superadmin-itest-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const attemptedPath = `/superadmin?probe=${uniqueArea}`;

        // Capture a window around the call so we can later assert the
        // server's `created_at` falls inside it. ±5s tolerates clock skew
        // between the test runner and the database.
        const before = new Date(Date.now() - 5_000);
        const { data, error } = await tenantA.client.functions.invoke(
          "log-forbidden-access",
          {
            method: "POST",
            body: {
              attemptedArea: uniqueArea,
              attemptedAreaLabel: "the Superadmin area",
              attemptedPath,
            },
          },
        );
        const after = new Date(Date.now() + 5_000);

        expect(error, `invoke error: ${error?.message}`).toBeNull();
        expect(data, "function returned no body").toBeTruthy();
        // The function returns { logged: true, tenantId, userId, at } on
        // the happy path. If `logged` is false we want to see the reason
        // in the failure message — most likely "no_tenant" if the
        // fixture's user lost their membership somehow.
        expect(
          (data as { logged?: boolean; reason?: string }).logged,
          `function returned logged=false (reason=${
            (data as { reason?: string }).reason ?? "unknown"
          })`,
        ).toBe(true);
        expect((data as { userId?: string }).userId).toBe(tenantA.userId);

        // Now read the row back via service role to confirm the write
        // actually happened with the right shape — not just that the
        // function reported success.
        //
        // We filter by the unique area slug rather than by user_id alone
        // so concurrent test runs (or a real Forbidden mount during dev)
        // can't pollute the assertion.
        const { data: rows, error: readErr } = await admin
          .from("audit_log")
          .select("id, action, user_id, tenant_id, table_name, new_data, created_at")
          .eq("action", "forbidden_access")
          .eq("user_id", tenantA.userId)
          // Postgrest JSONB path filter — matches new_data.attempted_area.
          .eq("new_data->>attempted_area", uniqueArea);

        expect(readErr, `audit_log read error: ${readErr?.message}`).toBeNull();
        expect(
          rows,
          "expected exactly one audit_log row for this attempted area",
        ).toHaveLength(1);

        const row = rows![0] as {
          id: string;
          action: string;
          user_id: string;
          tenant_id: string;
          table_name: string;
          new_data: Record<string, unknown>;
          created_at: string;
        };
        createdRowIds.add(row.id);

        // The headline assertions: action, user attribution, tenant
        // attribution, and the canonical table_name we use for route
        // denials.
        expect(row.action).toBe("forbidden_access");
        expect(row.user_id).toBe(tenantA.userId);
        expect(row.tenant_id).toBe(tenantA.tenantId);
        expect(row.table_name).toBe("auth_routes");

        // The payload echoes the slug, the human label, and the path —
        // all three are needed so the Superadmin audit panel can render
        // a useful row.
        expect(row.new_data.attempted_area).toBe(uniqueArea);
        expect(row.new_data.attempted_area_label).toBe("the Superadmin area");
        expect(row.new_data.attempted_path).toBe(attemptedPath);

        // created_at is a SERVER timestamp (column default `now()`), not
        // a client-supplied value. Verify it falls inside our capture
        // window — this catches both "the function forwarded the client
        // clock" and "the row was written hours late from a queue".
        const createdAt = new Date(row.created_at);
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      },
      // Network round trips: function invoke + admin read. 30s leaves
      // headroom for cold starts on the edge runtime without flaking.
      30_000,
    );

    it(
      "ignores any client-supplied user_id and attributes the row to the JWT subject",
      async () => {
        const tenantA = fixture.a!;
        const tenantB = fixture.b!;

        // The function deliberately doesn't accept `user_id` in its
        // payload — it always reads from the verified JWT. We send a
        // bogus value anyway to confirm the server doesn't honour it.
        // If this test ever starts failing, the function has regressed
        // and is trusting client-supplied identity (a privilege-
        // escalation bug).
        const uniqueArea = `superadmin-itest-spoof-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

        const { data, error } = await tenantA.client.functions.invoke(
          "log-forbidden-access",
          {
            method: "POST",
            body: {
              attemptedArea: uniqueArea,
              attemptedAreaLabel: "the Superadmin area",
              attemptedPath: `/superadmin?spoof=${uniqueArea}`,
              // Spoof attempt: claim to be tenantB's user.
              user_id: tenantB.userId,
              userId: tenantB.userId,
              tenantId: tenantB.tenantId,
            },
          },
        );

        expect(error).toBeNull();
        expect((data as { logged?: boolean }).logged).toBe(true);
        // Server reports the JWT user, not the spoofed one.
        expect((data as { userId?: string }).userId).toBe(tenantA.userId);

        const { data: rows } = await admin
          .from("audit_log")
          .select("id, user_id, tenant_id")
          .eq("action", "forbidden_access")
          .eq("new_data->>attempted_area", uniqueArea);

        expect(rows).toHaveLength(1);
        const row = rows![0] as {
          id: string;
          user_id: string;
          tenant_id: string;
        };
        createdRowIds.add(row.id);

        // The audit row is attributed to the JWT user even though we
        // tried to claim someone else's identity in the body. This is
        // the contract the entire audit pipeline depends on.
        expect(row.user_id).toBe(tenantA.userId);
        // Tenant attribution also follows the JWT user, not the
        // tenantId hint — tenantB hint is ignored because tenantA's
        // user is not a member of tenantB.
        expect(row.tenant_id).toBe(tenantA.tenantId);
        expect(row.tenant_id).not.toBe(tenantB.tenantId);
      },
      30_000,
    );
  },
);

// When the fixture is unavailable, emit a single placeholder so the
// reason shows up in CI test output instead of just "0 tests run".
if (!canRunFully) {
  describe("log-forbidden-access audit integration", () => {
    it.skip(skipReason!, () => {
      // intentionally empty — the skip message is the entire signal
    });
  });
}
