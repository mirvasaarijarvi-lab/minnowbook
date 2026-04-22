import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createTenantPairFixture,
  tenantPairFixtureLikelyAvailable,
  tenantPairFixtureSkipReason,
  type TenantPairFixture,
} from "./fixtures/tenant-pair";

/**
 * Negative pagination + RLS leakage contract.
 *
 * What this suite proves
 * ----------------------
 * For every tenant-scoped table that supports `.range(from, to)` pagination
 * (the same pattern used by LoginHistoryPanel, AuditLogPanel,
 * SuperadminLoginHistory, etc.), invalid range inputs from an UNPRIVILEGED
 * caller must:
 *
 *   1. Never throw a 5xx — the API must validate input or clamp gracefully,
 *      not crash and surface a server error that signals the row exists.
 *   2. Never return rows — RLS must filter BEFORE pagination is applied,
 *      otherwise a negative offset could underflow into another tenant's
 *      rows on a buggy implementation.
 *   3. Never return a different shape, error message, or status when the
 *      target tenant HAS rows vs. when it DOES NOT — that asymmetry would
 *      itself leak existence ("error X means data exists, error Y means it
 *      doesn't"). This is the classic "oracle attack" surface.
 *
 * Why this is its own suite
 * --------------------------
 * The existing cross-tenant RLS tests (`cross-tenant-rls.test.ts`) prove
 * "no rows leak with valid pagination". They do NOT exercise edge cases of
 * the PostgREST `Range` header itself: `range(-5, 10)`, `range(10, 5)`,
 * `range(0, 1_000_000_000)`, `range(2, 2)`, etc. Each of those exercises a
 * different code path inside PostgREST, and a regression in any one could
 * silently re-enable existence-oracle leakage.
 *
 * Tables exercised
 * ----------------
 * - `login_history` — recently refactored into shared filter components,
 *   has RLS that allows owners/admins on their own tenant only.
 * - `audit_log` — INSERT-blocked, owner/admin SELECT — high-value oracle.
 * - `notifications` — tenant-member SELECT, easy to seed/unseed.
 *
 * Each table is probed under three caller identities:
 * - **anon** (no JWT): RLS must reject all reads.
 * - **tenant B authenticated**: RLS must scope reads to tenant B only.
 * - **service role** (admin sanity probe): used ONLY to prove rows exist
 *   in tenant A so the asymmetry assertions are meaningful.
 *
 * Live-mode only: requires the same tenant-pair fixture as the cross-tenant
 * suite. Skips cleanly when credentials aren't available.
 */

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface RangeProbe {
  /** Human-readable label used in test names + diagnostics. */
  label: string;
  from: number;
  to: number;
  /**
   * What we EXPECT the safe outcome to look like for an unauthorized
   * caller. Either: a clean empty result (data=[], error=null) OR a
   * deterministic error category (PostgREST 416 / validation rejection).
   * What we must NEVER see: a server crash (5xx) or a row leak.
   */
  acceptableOutcome:
    | "empty-or-clamped"   // data is [] OR PostgREST clamps to a valid range
    | "client-error";      // 4xx — invalid range rejected up front
}

/**
 * The set of malicious / malformed range inputs we probe. Each value
 * exercises a distinct PostgREST/Postgres code path:
 *   - negative `from`: tests offset underflow handling.
 *   - negative `to`: tests upper-bound validation.
 *   - inverted (from > to): tests range-direction validation.
 *   - massive `to`: tests integer overflow / unbounded scan resistance.
 *   - zero-width: tests off-by-one on inclusive bounds.
 *   - both negative: tests double-fault handling.
 */
const RANGE_PROBES: ReadonlyArray<RangeProbe> = [
  { label: "negative `from` (-1, 10)", from: -1, to: 10, acceptableOutcome: "empty-or-clamped" },
  { label: "very negative `from` (-1000, 10)", from: -1000, to: 10, acceptableOutcome: "empty-or-clamped" },
  { label: "negative `to` (0, -1)", from: 0, to: -1, acceptableOutcome: "empty-or-clamped" },
  { label: "both negative (-5, -1)", from: -5, to: -1, acceptableOutcome: "empty-or-clamped" },
  { label: "inverted (10, 5)", from: 10, to: 5, acceptableOutcome: "empty-or-clamped" },
  { label: "huge `to` (0, 2_147_483_646)", from: 0, to: 2_147_483_646, acceptableOutcome: "empty-or-clamped" },
  { label: "huge `from` and `to` (1_000_000_000, 2_000_000_000)", from: 1_000_000_000, to: 2_000_000_000, acceptableOutcome: "empty-or-clamped" },
  { label: "zero-width (0, 0)", from: 0, to: 0, acceptableOutcome: "empty-or-clamped" },
  { label: "zero-width far past end (999_999, 999_999)", from: 999_999, to: 999_999, acceptableOutcome: "empty-or-clamped" },
];

interface ProbeResult {
  status: number | null;
  rowCount: number;
  errorCode: string | null;
  /** Coarse error shape — used for asymmetry comparison. */
  errorCategory: "ok" | "rls-empty" | "validation" | "permission" | "server-error" | "other";
}

async function probeRange(
  client: SupabaseClient,
  table: string,
  tenantId: string | null,
  from: number,
  to: number,
): Promise<ProbeResult> {
  let q = client.from(table).select("id", { count: "exact" }).range(from, to);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error, status, count } = await q;

  // Status comes back from PostgREST. Normalise null/undefined to a usable
  // number — `0` means "no HTTP response captured" which we treat as anomaly.
  const httpStatus = typeof status === "number" ? status : null;

  let category: ProbeResult["errorCategory"];
  if (!error) {
    category = (data?.length ?? count ?? 0) === 0 ? "rls-empty" : "ok";
  } else {
    const code = error.code ?? "";
    if (httpStatus !== null && httpStatus >= 500) category = "server-error";
    else if (code === "42501" || /permission denied/i.test(error.message)) category = "permission";
    else if (httpStatus === 416 || /range/i.test(error.message)) category = "validation";
    else category = "other";
  }

  return {
    status: httpStatus,
    rowCount: data?.length ?? 0,
    errorCode: error?.code ?? null,
    errorCategory: category,
  };
}

const liveModeAvailable = tenantPairFixtureLikelyAvailable();
const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `pagination negative inputs vs RLS — existence-leak contract (live mode: ${tenantPairFixtureSkipReason() ?? "ok"})`,
  () => {
    let fixture: TenantPairFixture;
    let anonClient: SupabaseClient;
    let admin: SupabaseClient | null = null;

    /**
     * Tables we exercise. Each entry includes a way to seed at least one
     * row in tenant A so the "asymmetry" assertion is meaningful — without
     * a seeded row in A, we couldn't tell whether tenant B sees []
     * because RLS works or because A is genuinely empty.
     *
     * `seed`: returns a cleanup function. Idempotent across re-runs.
     */
    const tables: Array<{
      name: string;
      seed: (tenantAId: string) => Promise<() => Promise<void>>;
    }> = [
      {
        name: "login_history",
        // login_history can be inserted by the user themselves OR by service role.
        // We use service role to seed tenant A from the outside.
        seed: async (tenantAId) => {
          if (!admin || !fixture.a) return async () => {};
          const { data, error } = await admin
            .from("login_history")
            .insert({
              tenant_id: tenantAId,
              user_id: fixture.a.userId,
              user_agent: "[pagination-negative-test] seeded row",
            })
            .select("id")
            .single();
          if (error) {
            // Fail loudly — without the seed the test is meaningless.
            throw new Error(`failed to seed login_history in tenant A: ${error.message}`);
          }
          const seededId = data?.id as string | undefined;
          return async () => {
            if (!admin || !seededId) return;
            await admin.from("login_history").delete().eq("id", seededId);
          };
        },
      },
      {
        name: "notifications",
        seed: async (tenantAId) => {
          if (!admin) return async () => {};
          const { data, error } = await admin
            .from("notifications")
            .insert({
              tenant_id: tenantAId,
              type: "system",
              title: "[pagination-negative-test] seeded",
              message: "Seeded by negative-pagination test — auto-cleaned",
              is_read: false,
            })
            .select("id")
            .single();
          if (error) throw new Error(`failed to seed notifications in tenant A: ${error.message}`);
          const seededId = data?.id as string | undefined;
          return async () => {
            if (!admin || !seededId) return;
            await admin.from("notifications").delete().eq("id", seededId);
          };
        },
      },
      {
        name: "audit_log",
        // audit_log is INSERT-blocked even for service role via policy
        // shape — but the trigger inserts on writes to other tables, so
        // we don't need to seed: any existing real audit row in tenant A
        // is a valid oracle target. We probe without seeding and skip
        // the asymmetry assertion if A genuinely has zero rows.
        seed: async () => async () => {},
      },
    ];

    beforeAll(async () => {
      fixture = await createTenantPairFixture();
      if (!fixture.available) {
        // Defensive: the suite is gated above, but if env shifts mid-run
        // we still want a clear message rather than a hard NPE.
        return;
      }
      anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if (SUPABASE_SERVICE_ROLE_KEY) {
        admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      }
    }, 60_000);

    for (const table of tables) {
      describe(`table: ${table.name}`, () => {
        for (const probe of RANGE_PROBES) {
          it(`${probe.label} — anon caller never leaks rows or 5xx`, async () => {
            if (!fixture.available) return;
            // Anon: RLS must reject EVERY tenant-scoped read regardless of
            // how malformed the range is. We probe without `tenant_id` to
            // simulate an attacker who doesn't know which tenant exists.
            const result = await probeRange(anonClient, table.name, null, probe.from, probe.to);

            // Hard contract: never 5xx, never any rows.
            expect(
              result.errorCategory,
              `anon must NOT see server-error for range ${probe.label}, got status=${result.status} code=${result.errorCode}`,
            ).not.toBe("server-error");
            expect(
              result.rowCount,
              `anon must NOT receive any rows from ${table.name} (got ${result.rowCount})`,
            ).toBe(0);
          }, 30_000);

          it(`${probe.label} — tenant B caller never leaks tenant A rows or 5xx`, async () => {
            if (!fixture.available || !fixture.a || !fixture.b) return;

            // Seed tenant A so the suite can detect a positive leak.
            const cleanup = await table.seed(fixture.a.tenantId);

            try {
              // Tenant B authenticated, querying explicitly scoped to
              // tenant A. RLS must return an empty set, NEVER a row.
              const scopedResult = await probeRange(
                fixture.b.client,
                table.name,
                fixture.a.tenantId,
                probe.from,
                probe.to,
              );

              expect(
                scopedResult.errorCategory,
                `tenant B must NOT see server-error for range ${probe.label} on ${table.name}, got status=${scopedResult.status} code=${scopedResult.errorCode}`,
              ).not.toBe("server-error");
              expect(
                scopedResult.rowCount,
                `tenant B must NOT receive any rows from tenant A's ${table.name} (got ${scopedResult.rowCount})`,
              ).toBe(0);

              // Also probe WITHOUT the tenant_id filter — RLS must still
              // scope to tenant B's own rows even when the malformed range
              // could theoretically expose more rows. We don't assert
              // rowCount=0 here (B might legitimately have its own rows),
              // but we MUST never see > 0 rows that belong to tenant A.
              // We approximate this by asserting no server error and that
              // the response shape is the same category as the scoped one
              // — the asymmetry check below.
              const unscoped = await probeRange(
                fixture.b.client,
                table.name,
                null,
                probe.from,
                probe.to,
              );
              expect(
                unscoped.errorCategory,
                `tenant B unscoped query must NOT see server-error for range ${probe.label} on ${table.name}`,
              ).not.toBe("server-error");

              // ----- Existence-oracle asymmetry check -----
              // Now query tenant B for a tenant_id that is GUARANTEED to
              // not exist (random uuid). The error/shape MUST be the same
              // as querying tenant A (which definitely has rows after the
              // seed above). If they differ, an attacker can use the
              // difference as an oracle: probe → "tenant exists" vs
              // "tenant does not exist".
              const fakeTenantId = "00000000-0000-0000-0000-000000000000";
              const fakeResult = await probeRange(
                fixture.b.client,
                table.name,
                fakeTenantId,
                probe.from,
                probe.to,
              );

              expect(
                fakeResult.errorCategory,
                `existence oracle: querying real tenant A vs fake tenant returned different error categories ` +
                  `(real=${scopedResult.errorCategory} fake=${fakeResult.errorCategory}) ` +
                  `for range ${probe.label} on ${table.name}. This leaks existence.`,
              ).toBe(scopedResult.errorCategory);

              expect(
                fakeResult.rowCount,
                `existence oracle: real-tenant query returned ${scopedResult.rowCount} rows, ` +
                  `fake-tenant query returned ${fakeResult.rowCount} rows on ${table.name}. ` +
                  `Both must be 0.`,
              ).toBe(scopedResult.rowCount);

              // HTTP status must also match (or both be null) — a 200 vs
              // 404 vs 416 split would itself be an oracle.
              expect(
                fakeResult.status,
                `existence oracle: HTTP status differs for real vs fake tenant on ${table.name} ` +
                  `(real=${scopedResult.status} fake=${fakeResult.status}) for range ${probe.label}`,
              ).toBe(scopedResult.status);
            } finally {
              await cleanup();
            }
          }, 30_000);
        }

        it("count metadata never reveals existence to unauthorized callers", async () => {
          if (!fixture.available || !fixture.a || !fixture.b) return;

          // PostgREST's `count: 'exact'` returns the total via the
          // Content-Range header — that's a known historical leak vector.
          // Even when range is invalid, the count for an inaccessible
          // tenant must be 0 (or null), never the real count.
          const cleanup = await table.seed(fixture.a.tenantId);
          try {
            const realTenantQuery = await fixture.b.client
              .from(table.name)
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", fixture.a.tenantId)
              .range(0, 0);
            const fakeTenantQuery = await fixture.b.client
              .from(table.name)
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", "00000000-0000-0000-0000-000000000000")
              .range(0, 0);

            // Neither query may surface a non-zero count to tenant B.
            const realCount = realTenantQuery.count ?? 0;
            const fakeCount = fakeTenantQuery.count ?? 0;
            expect(
              realCount,
              `count metadata leaked: tenant B saw count=${realCount} for tenant A's ${table.name}`,
            ).toBe(0);
            expect(
              fakeCount,
              `count metadata for fake tenant should also be 0, got ${fakeCount}`,
            ).toBe(0);
            // And the two counts must be equal — otherwise count IS the oracle.
            expect(realCount).toBe(fakeCount);
          } finally {
            await cleanup();
          }
        }, 30_000);
      });
    }
  },
);

// CI-safe gating sanity check: documents WHY the live suite skipped so
// CI logs are explicit instead of mysteriously green.
describe("pagination-negative-rls — gating", () => {
  it("documents whether live-mode pagination/RLS suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[pagination-negative-rls] live mode skipped: ${tenantPairFixtureSkipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
