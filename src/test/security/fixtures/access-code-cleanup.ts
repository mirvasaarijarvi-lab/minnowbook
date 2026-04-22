import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared cleanup helper for access-code redemption tests.
 *
 * Why this exists
 * ----------------
 * The redemption test suites seed real rows in `access_codes` and
 * `access_code_redemptions` against the live database. If a test crashes
 * mid-race — between INSERT and the registration of the new row id, or
 * between `afterEach` and `afterAll`, or between two unrelated suites —
 * stale rows would otherwise accumulate run after run, eventually:
 *
 *   - polluting `used_count` invariants for the fixture tenant,
 *   - inflating ledger probes in defence-in-depth uniqueness assertions,
 *   - leaking test data into operator dashboards (Superadmin can see all
 *     access codes regardless of tenant).
 *
 * The defensive contract we want is: "Repeated runs never accumulate
 * stale rows, even if the test process is SIGKILL'd, even if a single
 * `it()` block throws halfway through a Promise.all." To get that we
 * combine three independent layers:
 *
 *   1. **Per-suite tag** — every code we seed carries a unique
 *      `description` prefix (e.g. `[authz-conc-test]`). This lets us
 *      sweep ALL rows from prior runs at the start of each suite, even
 *      if their UUIDs were lost when the previous process died.
 *
 *   2. **Tracker (in-memory)** — `seededCodeIds` records the IDs the
 *      current process has created. This is the fast path for
 *      `afterEach` / `afterAll` and ensures cleanup happens even if the
 *      `description` filter ever drifts.
 *
 *   3. **`created_by` filter** — when a fixture user is reused across
 *      runs, we additionally sweep by `created_by = fixtureUserId` as
 *      a belt-and-suspenders for any seeded row whose description was
 *      mistakenly omitted (e.g. a future test forgets the tag).
 *
 * All cleanup ops are best-effort: errors are swallowed so a failing
 * cleanup never masks the real test failure. The functions log warnings
 * so cleanup regressions are still visible in CI output.
 */

export interface AccessCodeCleanupConfig {
  /** Service-role admin client. Required to bypass RLS during cleanup. */
  admin: SupabaseClient;
  /**
   * Stable, unique tag included in EVERY seeded code's `description`.
   * Must be specific to the suite (e.g. `[authz-conc-test]`,
   * `[replay-test]`, `[xtenant-test]`).
   */
  descriptionTag: string;
  /**
   * Optional fixture user id. When present, cleanup also sweeps any
   * orphaned codes attributed to this user (catches future bugs where
   * a test forgets the description tag).
   */
  fixtureUserId?: string;
  /**
   * Optional tenant id whose redemption ledger should be wiped at the
   * start of each suite (in case prior runs crashed before resetting it).
   */
  fixtureTenantId?: string;
}

export interface AccessCodeTracker {
  /**
   * Add an id to the in-process tracker. Call this AFTER a successful
   * insert. The pre-flight `sweepStaleRows()` already covers crashes
   * that happened before this line ran in a prior process.
   */
  register(codeId: string): void;
  /**
   * Delete every code currently tracked + its redemptions. Safe to call
   * after every `it()` (so accumulation across tests is impossible)
   * and again in `afterAll`. Resets the tracker on success.
   */
  cleanupTracked(): Promise<void>;
  /**
   * Wipe rows from prior crashed runs by `description` tag and (if
   * configured) `created_by`. Run this in `beforeAll` BEFORE the first
   * seed so the suite always starts from a clean slate.
   */
  sweepStaleRows(): Promise<void>;
}

export function createAccessCodeTracker(
  config: AccessCodeCleanupConfig,
): AccessCodeTracker {
  const ids = new Set<string>();
  const { admin, descriptionTag, fixtureUserId, fixtureTenantId } = config;

  async function deleteByIds(idList: string[]) {
    if (idList.length === 0) return;
    // Delete dependent ledger rows first; FK constraints would otherwise
    // refuse the parent delete on some configurations.
    const { error: redErr } = await admin
      .from("access_code_redemptions")
      .delete()
      .in("access_code_id", idList);
    if (redErr) {
      console.warn(
        `[access-code-cleanup] redemption sweep error (ignored): ${redErr.message}`,
      );
    }
    const { error: codeErr } = await admin
      .from("access_codes")
      .delete()
      .in("id", idList);
    if (codeErr) {
      console.warn(
        `[access-code-cleanup] access_codes sweep error (ignored): ${codeErr.message}`,
      );
    }
  }

  return {
    register(codeId: string) {
      if (codeId) ids.add(codeId);
    },

    async cleanupTracked() {
      const snapshot = Array.from(ids);
      ids.clear();
      try {
        await deleteByIds(snapshot);
      } catch (err) {
        console.warn(
          `[access-code-cleanup] cleanupTracked threw (ignored): ${
            (err as Error).message
          }`,
        );
      }
    },

    async sweepStaleRows() {
      try {
        // Find all codes matching our suite tag OR our fixture user.
        // We use `like` on description to catch the unique tag and OR
        // it with created_by when a fixture user id is known.
        const query = admin
          .from("access_codes")
          .select("id")
          .ilike("description", `%${descriptionTag}%`);
        const { data: tagged, error: tagErr } = await query;
        const collected = new Set<string>();
        if (!tagErr) {
          for (const row of tagged ?? []) {
            if (row?.id) collected.add(row.id as string);
          }
        } else {
          console.warn(
            `[access-code-cleanup] tag-sweep query error (ignored): ${tagErr.message}`,
          );
        }
        if (fixtureUserId) {
          const { data: byUser, error: userErr } = await admin
            .from("access_codes")
            .select("id")
            .eq("created_by", fixtureUserId);
          if (!userErr) {
            for (const row of byUser ?? []) {
              if (row?.id) collected.add(row.id as string);
            }
          } else {
            console.warn(
              `[access-code-cleanup] user-sweep query error (ignored): ${userErr.message}`,
            );
          }
        }
        await deleteByIds(Array.from(collected));

        // Also wipe any orphaned redemption rows for the fixture tenant
        // whose parent access code no longer exists (or whose parent we
        // just deleted in a prior partial sweep).
        if (fixtureTenantId) {
          const { error: tenantLedgerErr } = await admin
            .from("access_code_redemptions")
            .delete()
            .eq("tenant_id", fixtureTenantId);
          if (tenantLedgerErr) {
            console.warn(
              `[access-code-cleanup] tenant-ledger sweep error (ignored): ${tenantLedgerErr.message}`,
            );
          }
        }
      } catch (err) {
        console.warn(
          `[access-code-cleanup] sweepStaleRows threw (ignored): ${
            (err as Error).message
          }`,
        );
      }
    },
  };
}
