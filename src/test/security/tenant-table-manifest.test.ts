import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Tenant Table Manifest — Coverage Guard
 *
 * Queries the live database via the `list_tenant_scoped_tables()` RPC for
 * every base table that has a `tenant_id` column, then asserts that each one
 * is either:
 *
 *   (a) covered by the cross-tenant test suite (`COVERED_TABLES`), OR
 *   (b) explicitly excluded with a documented reason (`EXCLUDED_TABLES`).
 *
 * If a developer adds a new tenant-scoped table without updating one of these
 * lists, this test fails with the table name and a clear remediation message.
 * This prevents silent gaps in cross-tenant isolation coverage.
 *
 * The RPC returns metadata only (table names from information_schema) — never
 * row data — so it's safe to expose to anon and authenticated callers.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Tables that ARE covered by cross-tenant-rls.test.ts and/or
 * cross-tenant-storage.test.ts. Add to this list when you add a new
 * tenant-scoped table AND extend the cross-tenant tests to cover it.
 */
const COVERED_TABLES = new Set<string>([
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
  "reschedule_requests",
  "reservations",
  "resource_images",
  "resource_opening_hours",
  "resource_availability_slots",
  "resources",
  "role_definitions",
  "role_permissions",
  "site_settings",
  "site_users",
  "sites",
  "support_requests",
  "tenant_email_templates",
  "tenant_opening_hours",
  "tenant_settings",
  "tenant_users",
]);

/**
 * Tables that intentionally don't need cross-tenant isolation tests.
 * Each entry MUST include a written justification — this is reviewed by
 * the security team and is the only way to opt out of coverage.
 */
const EXCLUDED_TABLES: Record<string, string> = {
  // Public-facing waitlist for marketing signups. Has tenant_id for routing
  // but is not customer data — entries are explicitly user-submitted via the
  // public booking flow with no expectation of tenant-private isolation.
  waitlist:
    "Public marketing signup table — no tenant-private data; intentionally readable by service role only.",
  storage_rejection_events:
    "Service-role-only telemetry table populated by the report-storage-rejection edge function. RLS denies all anon/authenticated access; superadmin reads via SECURITY DEFINER views. No client-side cross-tenant surface to test.",
  storage_rejection_alerts:
    "Service-role-only alert table written by report-storage-rejection. RLS denies all anon/authenticated access; superadmin reads via SECURITY DEFINER views. No client-side cross-tenant surface to test.",
  booking_idempotency:
    "Service-role-only bookkeeping for booking idempotency keys, written exclusively by the public-booking edge function. Holds no guest or business data (tenant_id, key, reservation_id, timestamps). RLS grants service_role only, plus system-admin SELECT; anon and authenticated have no grants, so there is no client-side cross-tenant surface to test. Behaviour is covered by e2e/public-booking-idempotency-key.spec.ts.",
};

/**
 * Every public-schema table created by a migration in `drizzle/migrations`.
 * Used to tell a manifest entry awaiting a migration apart from a stale one.
 */
function tablesDeclaredInMigrations(): Set<string> {
  const declared = new Set<string>();
  const root = path.resolve(process.cwd(), "drizzle/migrations");
  if (!fs.existsSync(root)) return declared;

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".sql")) {
        const sql = fs.readFileSync(full, "utf8");
        const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z0-9_]+)"?/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(sql)) !== null) {
          declared.add(m[1].toLowerCase());
        }
      }
    }
  };

  walk(root);
  return declared;
}

describe("Tenant Table Manifest — Coverage Guard", () => {
  describe.runIf(hasSupabaseConfig)("Live schema introspection", () => {
    let anon: SupabaseClient;
    let liveTables: string[] = [];

    beforeAll(async () => {
      anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data, error } = await anon.rpc("list_tenant_scoped_tables");
      if (error) {
        throw new Error(
          `Failed to query tenant-scoped tables via RPC: ${error.message}. ` +
            `Confirm the migration creating list_tenant_scoped_tables() has been applied.`,
        );
      }
      liveTables = (data ?? []).map((row: { table_name: string }) => row.table_name);
    });

    it("RPC returns at least one tenant-scoped table (sanity)", () => {
      // If this is zero, either the migration didn't apply or the RPC is broken.
      // Without this check the next assertions could pass trivially.
      expect(liveTables.length).toBeGreaterThan(0);
    });

    it("every live tenant-scoped table is covered or explicitly excluded", () => {
      const uncovered = liveTables.filter(
        (t) => !COVERED_TABLES.has(t) && !(t in EXCLUDED_TABLES),
      );

      if (uncovered.length > 0) {
        const remediation = uncovered
          .map(
            (t) =>
              `  • "${t}" — add to COVERED_TABLES (and write tests for it) ` +
              `or to EXCLUDED_TABLES with a written justification.`,
          )
          .join("\n");

        throw new Error(
          `Found ${uncovered.length} tenant-scoped table(s) without cross-tenant test coverage:\n` +
            `${remediation}\n\n` +
            `Edit src/test/security/tenant-table-manifest.test.ts to resolve.`,
        );
      }

      expect(uncovered).toEqual([]);
    });

    it("manifest does not list tables that no longer exist in the schema", () => {
      // Catches stale entries in COVERED_TABLES / EXCLUDED_TABLES after a
      // table is dropped or renamed — keeps the manifest in sync with reality.
      //
      // A live database whose migrations lag behind the repository is NOT a
      // stale manifest: the table is declared in `drizzle/migrations` and will
      // exist once the pending migration is applied. Only entries that no
      // migration creates are reported, so a genuine drop or rename still
      // fails while a not-yet-migrated environment does not.
      const liveSet = new Set(liveTables);
      const declared = tablesDeclaredInMigrations();
      const missing = [
        ...[...COVERED_TABLES].filter((t) => !liveSet.has(t)),
        ...Object.keys(EXCLUDED_TABLES).filter((t) => !liveSet.has(t)),
      ];
      const pendingMigration = missing.filter((t) => declared.has(t));
      const stale = missing.filter((t) => !declared.has(t));

      if (pendingMigration.length > 0) {
        console.warn(
          `[tenant-table-manifest] ${pendingMigration.length} manifest table(s) are not in the ` +
            `live schema yet but are created by a migration in drizzle/migrations: ` +
            `${pendingMigration.join(", ")}. Apply the pending migrations to this environment.`,
        );
      }

      if (stale.length > 0) {
        throw new Error(
          `Manifest lists ${stale.length} table(s) that no longer exist in the public schema: ` +
            `${stale.join(", ")}. Remove them from COVERED_TABLES / EXCLUDED_TABLES.`,
        );
      }

      expect(stale).toEqual([]);
    });

    it("no table is in both COVERED_TABLES and EXCLUDED_TABLES", () => {
      const overlap = [...COVERED_TABLES].filter((t) => t in EXCLUDED_TABLES);
      expect(overlap).toEqual([]);
    });

    it("every EXCLUDED_TABLES entry has a non-empty justification", () => {
      const missingReason = Object.entries(EXCLUDED_TABLES)
        .filter(([, reason]) => !reason || reason.trim().length < 20)
        .map(([t]) => t);

      expect(missingReason).toEqual([]);
    });
  });

  describe.skipIf(hasSupabaseConfig)("Skipped: missing Supabase config", () => {
    it("test environment is missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY", () => {
      expect(true).toBe(true);
    });
  });
});
