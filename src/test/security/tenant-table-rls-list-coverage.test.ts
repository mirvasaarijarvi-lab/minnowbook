import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  coverageGaps,
  readRecordKeys,
  readStringList,
  tenantTablesFromSql,
  tenantTablesInMigrations,
} from "./fixtures/tenant-table-coverage";

/**
 * Offline guard (no database needed): every public table that the migrations
 * give a `tenant_id` column must be in the cross-business RLS test list
 * (TENANT_SCOPED_TABLES in cross-tenant-rls.test.ts), or excluded with a
 * written reason (EXCLUDED_TABLES in tenant-table-manifest.test.ts).
 *
 * The live manifest check only runs with database access; this one runs on
 * every PR from the migration files alone, so a new table can't slip through.
 */
const root = process.cwd();
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const RLS_FILE = "src/test/security/cross-tenant-rls.test.ts";
const MANIFEST_FILE = "src/test/security/tenant-table-manifest.test.ts";

describe("Cross-business RLS test list covers every tenant-scoped table", () => {
  const migrationTables = tenantTablesInMigrations(root);
  const rlsTables = readStringList(read(RLS_FILE), "TENANT_SCOPED_TABLES");
  const excluded = readRecordKeys(read(MANIFEST_FILE), "EXCLUDED_TABLES");

  it("finds the tenant-scoped tables in the migrations (sanity)", () => {
    expect(migrationTables.size).toBeGreaterThanOrEqual(40);
    for (const t of ["reservations", "tenant_users", "booking_tokens"]) {
      expect(migrationTables.has(t)).toBe(true);
    }
  });

  it("every tenant-scoped table is in the RLS test list or excluded with a reason", () => {
    const gaps = coverageGaps({
      migrationTables,
      rlsTestTables: rlsTables,
      otherSuiteTables: new Set(),
      excluded,
    });
    if (gaps.length) {
      throw new Error(
        `Found ${gaps.length} tenant-scoped table(s) missing from the cross-business RLS test list:\n` +
          gaps
            .map(
              (t) =>
                `  • "${t}": add it to TENANT_SCOPED_TABLES in ${RLS_FILE} (and PRIVATE_ONLY_TABLES if nobody outside the business may read it), or to EXCLUDED_TABLES in ${MANIFEST_FILE} with a written reason.`,
            )
            .join("\n"),
      );
    }
  });

  it("the RLS test list has no tables the migrations don't define", () => {
    const stale = [...rlsTables].filter((t) => !migrationTables.has(t)).sort();
    expect(
      stale,
      `remove from TENANT_SCOPED_TABLES: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("no table is both tested and excluded", () => {
    expect([...excluded].filter((t) => rlsTables.has(t))).toEqual([]);
  });
});

describe("tenant table finder (fixture tests)", () => {
  it("finds a new table with tenant_id, and flags it as a gap", () => {
    const found = tenantTablesFromSql([
      `CREATE TABLE public.guest_notes (id uuid primary key, tenant_id uuid not null references public.tenants(id), body text);`,
    ]);
    expect([...found]).toEqual(["guest_notes"]);
    expect(
      coverageGaps({
        migrationTables: found,
        rlsTestTables: new Set(),
        otherSuiteTables: new Set(),
        excluded: new Set(),
      }),
    ).toEqual(["guest_notes"]);
    expect(
      coverageGaps({
        migrationTables: found,
        rlsTestTables: new Set(["guest_notes"]),
        otherSuiteTables: new Set(),
        excluded: new Set(),
      }),
    ).toEqual([]);
  });

  it("handles quoted names, IF NOT EXISTS and nested brackets", () => {
    const found = tenantTablesFromSql([
      `create table if not exists "public"."x_a" (id uuid, amount numeric(10,2) check (amount > 0), "tenant_id" uuid);`,
    ]);
    expect([...found]).toEqual(["x_a"]);
  });

  it("finds tenant_id added later with ALTER TABLE", () => {
    const found = tenantTablesFromSql([
      `create table public.x_b (id uuid);`,
      `ALTER TABLE public.x_b ADD COLUMN IF NOT EXISTS tenant_id uuid references public.tenants(id);`,
    ]);
    expect([...found]).toEqual(["x_b"]);
  });

  it("ignores tables without tenant_id, other schemas, comments and similar names", () => {
    const found = tenantTablesFromSql([
      `create table public.plain (id uuid, other_tenant_id_note text);`,
      `create table auth.sneaky (tenant_id uuid);`,
      `-- create table public.commented (tenant_id uuid);`,
      `/* create table public.blocked (tenant_id uuid); */`,
    ]);
    expect([...found]).toEqual([]);
  });

  it("drops a table that a later migration drops, but not on ALTER PUBLICATION ... DROP TABLE", () => {
    const found = tenantTablesFromSql([
      `create table public.gone (tenant_id uuid); create table public.kept (tenant_id uuid);`,
      `DROP TABLE IF EXISTS public.gone; ALTER PUBLICATION supabase_realtime DROP TABLE public.kept;`,
    ]);
    expect([...found]).toEqual(["kept"]);
  });

  it("reads list entries and record keys from source, skipping comments", () => {
    const src = `const L = [\n "a_one",\n // "commented_out",\n 'b_two',\n] as const;\nconst R: Record<string,string> = {\n  // note\n  c_three: "why",\n  "d_four": "why",\n};`;
    expect([...readStringList(src, "L")]).toEqual(["a_one", "b_two"]);
    expect([...readRecordKeys(src, "R")]).toEqual(["c_three", "d_four"]);
  });
});
