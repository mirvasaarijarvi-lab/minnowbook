import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema/index gate.
 *
 * The dashboard's reservations queries depend on a specific set of Postgres
 * indexes on `public.reservations` (tenant-scoped lookups, trigram search on
 * guest fields, capacity lookups, etc.). Dropping or renaming any of these
 * silently regresses dashboard performance from O(log n) to seq scans on
 * tables that grow unbounded per tenant, with no compile-time signal.
 *
 * This test parses every migration in supabase/migrations/ and asserts that
 * each expected index appears in at least one CREATE INDEX statement targeting
 * public.reservations. It runs entirely against repo files, so it has no
 * network or Supabase env-var dependencies and can gate the build in CI even
 * for forks without secrets.
 *
 * To intentionally remove an index: delete it from EXPECTED_INDEXES *and*
 * write a migration that drops it. Both must happen in the same PR.
 */

const EXPECTED_INDEXES = [
  "idx_reservations_tenant_date",
  "idx_reservations_tenant_status",
  "idx_reservations_tenant_type",
  "idx_reservations_tenant_invoiced",
  "idx_reservations_tenant_checkout",
  "idx_reservations_tenant_email",
  "idx_reservations_guest_name_trgm",
  "idx_reservations_guest_email_trgm",
  "idx_reservations_guest_phone_trgm",
  "idx_reservations_guest_search_trgm",
  "idx_reservations_capacity_lookup",
  "idx_reservations_site_id",
  "idx_reservations_discount_code_id",
] as const;

function loadMigrationCorpus(): string {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  return files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
}

describe("reservations indexes (schema gate)", () => {
  const corpus = loadMigrationCorpus();

  for (const name of EXPECTED_INDEXES) {
    it(`migration corpus declares ${name} on public.reservations`, () => {
      // Match: CREATE [UNIQUE] INDEX [IF NOT EXISTS] <name> ON [public.]reservations
      const pattern = new RegExp(
        `CREATE\\s+(?:UNIQUE\\s+)?INDEX(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${name}\\s+ON\\s+(?:public\\.)?reservations\\b`,
        "i"
      );
      expect(
        pattern.test(corpus),
        `Expected index "${name}" to be created on public.reservations in some migration. ` +
          `If you renamed or removed it, update EXPECTED_INDEXES in this file in the same PR.`
      ).toBe(true);
    });
  }
});
