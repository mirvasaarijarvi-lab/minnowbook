import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Plan-references gate.
 *
 * .lovable/plan.md tracks the in-flight feature roadmap. Whenever the plan
 * names a database table (e.g. "Add a `booking_tokens` table") or a specific
 * migration filename, the underlying artifact must actually exist in the repo
 * by the time that PR merges. Otherwise the plan drifts out of sync with the
 * shipped schema and we ship dashboard features whose backing tables were
 * never created.
 *
 * Two checks:
 *   1. Every backtick-quoted snake_case table name mentioned in the plan
 *      with the word "table" nearby must appear as `CREATE TABLE public.<name>`
 *      in some migration file.
 *   2. Every migration filename referenced in the plan (timestamped *.sql
 *      under supabase/migrations/) must exist on disk.
 *
 * Runs purely against repo files, so it gates the build in CI without
 * requiring Supabase credentials.
 */

const PLAN_PATH = join(process.cwd(), ".lovable", "plan.md");
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function loadMigrationCorpus(): string {
  if (!existsSync(MIGRATIONS_DIR)) return "";
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

function extractReferencedTables(plan: string): string[] {
  // Match constructs like: `booking_tokens` table  /  a `waitlist` table  /
  // Add a `guest_reviews` table. Tolerates an adjective ("new", "shared")
  // between the backticks and the word "table".
  const re = /`([a-z][a-z0-9_]+)`\s+(?:[a-z]+\s+)?table\b/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(plan)) !== null) {
    out.add(m[1]);
  }
  return [...out];
}

function extractReferencedMigrationFiles(plan: string): string[] {
  // Match: 20260511102504_d5816486-....sql (timestamp prefix is enough)
  const re = /\b(\d{14}[A-Za-z0-9_-]*\.sql)\b/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(plan)) !== null) {
    out.add(m[1]);
  }
  return [...out];
}

describe("plan references gate", () => {
  it("plan.md exists", () => {
    expect(existsSync(PLAN_PATH), `${PLAN_PATH} not found`).toBe(true);
  });

  const plan = existsSync(PLAN_PATH) ? readFileSync(PLAN_PATH, "utf8") : "";
  const corpus = loadMigrationCorpus();
  const referencedTables = extractReferencedTables(plan);
  const referencedMigrations = extractReferencedMigrationFiles(plan);

  it("plan signal extraction is wired (or plan is non-schema)", () => {
    // Original guard ensured the regexes hadn't silently regressed to
    // matching nothing. That guard fired false positives for plans
    // that legitimately make no schema changes (refactors, UI work,
    // edge-function-only changes). Treat the gate as vacuous-but-OK
    // when the plan body never mentions DB-shaped vocabulary; if it
    // does, the regexes must produce at least one hit.
    const looksSchemaShaped =
      /\b(?:table|tables|migration|migrations|column|columns|RLS)\b/i.test(plan);
    if (!looksSchemaShaped) {
      expect(true, "plan.md describes no schema work, gate is vacuous").toBe(true);
      return;
    }
    expect(
      referencedTables.length + referencedMigrations.length,
      "plan.md mentions schema vocabulary but the extractor returned nothing. " +
        "Either rephrase the plan or update the regexes."
    ).toBeGreaterThan(0);
  });

  for (const table of referencedTables) {
    it(`plan-referenced table "${table}" has a CREATE TABLE in migrations`, () => {
      const pattern = new RegExp(
        `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table}\\b`,
        "i"
      );
      expect(
        pattern.test(corpus),
        `Plan mentions \`${table}\` table but no migration creates public.${table}. ` +
          `Either add the migration in this PR or remove the reference from plan.md.`
      ).toBe(true);
    });
  }

  for (const file of referencedMigrations) {
    it(`plan-referenced migration ${file} exists on disk`, () => {
      expect(
        existsSync(join(MIGRATIONS_DIR, file)),
        `plan.md names migration ${file} but it does not exist under supabase/migrations/.`
      ).toBe(true);
    });
  }
});
