import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Reservations schema snapshot.
 *
 * Walks every migration under `supabase/migrations/` in chronological order,
 * applies CREATE INDEX / DROP INDEX statements that target
 * `public.reservations`, and emits an effective snapshot of:
 *
 *   - every index that survives to the live schema (name -> definition)
 *   - the sorted set of columns referenced by those indexes
 *
 * That snapshot is then compared to the manifest checked in at
 * `src/test/schema/__snapshots__/reservations-schema.json`.
 *
 * Any drift (index added, removed, or its definition changed; an indexed
 * column appears or disappears) fails the schema-gate CI job with a precise
 * diff. To intentionally update the manifest, re-run the test with:
 *
 *   UPDATE_SCHEMA_SNAPSHOT=1 bunx vitest run src/test/schema/reservations-schema-snapshot.test.ts
 *
 * Updating the manifest is a deliberate, reviewable act: the snapshot diff
 * becomes part of the PR and a reviewer can confirm the change is intended
 * (e.g. a new dashboard query that justifies a new index).
 */

interface IndexRecord {
  /** Normalized CREATE INDEX statement (single line, collapsed whitespace). */
  definition: string;
  /** Ordered list of columns referenced inside the parenthesized index list. */
  columns: string[];
  /** Optional partial-index predicate (text after WHERE), or null. */
  where: string | null;
}

interface Snapshot {
  indexes: Record<string, IndexRecord>;
  indexed_columns: string[];
}

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const MANIFEST_PATH = join(
  process.cwd(),
  "src",
  "test",
  "schema",
  "__snapshots__",
  "reservations-schema.json",
);

function listMigrationsChronologically(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // timestamped names sort lexically == chronologically
}

function splitStatements(sql: string): string[] {
  // Strip line comments, then split on `;` at end of statement. Naive but
  // fine here: our migrations don't embed `;` inside string literals on the
  // CREATE INDEX / DROP INDEX statements we care about.
  const stripped = sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalize(stmt: string): string {
  return stmt.replace(/\s+/g, " ").trim();
}

function isReservationsIndex(stmt: string): boolean {
  // Matches: CREATE [UNIQUE] INDEX [IF NOT EXISTS] <name> ON [public.]reservations ...
  return /^CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+\S+\s+ON\s+(?:public\.)?reservations\b/i
    .test(stmt);
}

function parseIndexName(stmt: string): string | null {
  const m = stmt.match(
    /^CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)\b/i,
  );
  return m ? m[1] : null;
}

function parseDropIndexNames(stmt: string): string[] {
  // DROP INDEX [IF EXISTS] [public.]name [, [public.]name ...]
  const m = stmt.match(/^DROP\s+INDEX(?:\s+IF\s+EXISTS)?\s+(.+)$/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((n) => n.trim().replace(/^public\./i, "").replace(/[";]+$/g, ""))
    .filter((n) => /^idx_reservations_/i.test(n));
}

function parseColumnsAndWhere(stmt: string): {
  columns: string[];
  where: string | null;
} {
  // Find the FIRST top-level parenthesized group (the index column list).
  // Track depth so we don't get confused by gin_trgm_ops parens, etc.
  const open = stmt.indexOf("(");
  if (open === -1) return { columns: [], where: null };

  let depth = 0;
  let close = -1;
  for (let i = open; i < stmt.length; i++) {
    if (stmt[i] === "(") depth++;
    else if (stmt[i] === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return { columns: [], where: null };

  const inside = stmt.slice(open + 1, close);
  // Split on commas at depth 0 within this slice.
  const parts: string[] = [];
  let buf = "";
  let d = 0;
  for (const ch of inside) {
    if (ch === "(") d++;
    if (ch === ")") d--;
    if (ch === "," && d === 0) {
      parts.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());

  // Each part looks like:  "tenant_id"  |  "date DESC"  |  "guest_name gin_trgm_ops"
  // We want the leading identifier only. Strip any opclass/order modifiers.
  const columns = parts.map((p) => {
    const tok = p.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    return tok ? tok[1] : p;
  });

  // Anything after the closing paren may include "WHERE <predicate>".
  const tail = stmt.slice(close + 1);
  const wm = tail.match(/\bWHERE\s+(.+)$/i);
  const where = wm ? wm[1].trim() : null;

  return { columns, where };
}

function buildSnapshot(): Snapshot {
  const indexes: Record<string, IndexRecord> = {};

  for (const file of listMigrationsChronologically()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const stmt of splitStatements(sql)) {
      const norm = normalize(stmt);

      if (isReservationsIndex(norm)) {
        const name = parseIndexName(norm);
        if (!name) continue;
        const { columns, where } = parseColumnsAndWhere(norm);
        indexes[name] = { definition: norm, columns, where };
        continue;
      }

      if (/^DROP\s+INDEX/i.test(norm)) {
        for (const name of parseDropIndexNames(norm)) {
          delete indexes[name];
        }
      }
    }
  }

  // Stable, deterministic ordering for the snapshot file.
  const sortedIndexes: Record<string, IndexRecord> = {};
  for (const k of Object.keys(indexes).sort()) {
    sortedIndexes[k] = indexes[k];
  }

  const columnSet = new Set<string>();
  for (const rec of Object.values(sortedIndexes)) {
    for (const c of rec.columns) columnSet.add(c);
  }

  return {
    indexes: sortedIndexes,
    indexed_columns: [...columnSet].sort(),
  };
}

describe("reservations schema snapshot", () => {
  const current = buildSnapshot();

  // Vacuity guard: if our parser breaks and returns an empty snapshot,
  // the equality check below would also pass against an empty manifest.
  // Anchor on the floor we know is true today.
  it("parser finds at least 10 effective reservations indexes", () => {
    expect(Object.keys(current.indexes).length).toBeGreaterThanOrEqual(10);
  });

  it("parser extracts at least the core dashboard columns", () => {
    for (const col of ["tenant_id", "date", "status", "reservation_type"]) {
      expect(current.indexed_columns).toContain(col);
    }
  });

  it("matches the checked-in manifest", () => {
    if (process.env.UPDATE_SCHEMA_SNAPSHOT === "1") {
      writeFileSync(MANIFEST_PATH, JSON.stringify(current, null, 2) + "\n");
      console.warn(
        `[schema-snapshot] Updated ${MANIFEST_PATH}. ` +
          `Review the diff in your PR before merging.`,
      );
      return;
    }

    if (!existsSync(MANIFEST_PATH)) {
      throw new Error(
        `Manifest missing at ${MANIFEST_PATH}. ` +
          `Run with UPDATE_SCHEMA_SNAPSHOT=1 to create it, then commit the file.`,
      );
    }

    const expected = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Snapshot;

    // Vitest's deep-equal already produces a readable diff, but we precompute
    // a name-level summary so a reviewer eyeballing the failure log sees
    // immediately which indexes drifted instead of just a wall of definitions.
    const currentNames = new Set(Object.keys(current.indexes));
    const expectedNames = new Set(Object.keys(expected.indexes));
    const added = [...currentNames].filter((n) => !expectedNames.has(n));
    const removed = [...expectedNames].filter((n) => !currentNames.has(n));
    const changed = [...currentNames]
      .filter((n) => expectedNames.has(n))
      .filter(
        (n) =>
          JSON.stringify(current.indexes[n]) !==
          JSON.stringify(expected.indexes[n]),
      );

    if (added.length || removed.length || changed.length) {
      const summary = [
        added.length ? `  + added:   ${added.join(", ")}` : null,
        removed.length ? `  - removed: ${removed.join(", ")}` : null,
        changed.length ? `  ~ changed: ${changed.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      console.error(
        `[schema-snapshot] Drift detected in public.reservations indexes:\n${summary}\n` +
          `If this drift is intentional, re-run with UPDATE_SCHEMA_SNAPSHOT=1 ` +
          `and commit src/test/schema/__snapshots__/reservations-schema.json.`,
      );
    }

    expect(current).toEqual(expected);
  });
});
