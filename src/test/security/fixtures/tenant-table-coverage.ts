/**
 * Offline coverage check helpers: find every public table that gets a
 * `tenant_id` column in the migrations, and read the table lists from the
 * cross-business RLS test and the manifest, without a database.
 */
import fs from "node:fs";
import path from "node:path";

const MIGRATION_DIRS = ["supabase/migrations", "drizzle/migrations"];

function sqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sqlFiles(full));
    else if (e.name.endsWith(".sql")) out.push(full);
  }
  return out.sort();
}

/** Strips -- and block comments so commented-out SQL is ignored. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** Returns the parenthesised body starting at `open`, balancing brackets. */
function balancedBody(sql: string, open: number): string {
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return sql.slice(open + 1, i);
  }
  return sql.slice(open + 1);
}

const NAME = String.raw`(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?`;
const CREATE_RE = new RegExp(
  String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?` + NAME + String.raw`\s*\(`,
  "gi",
);
const ALTER_ADD_RE = new RegExp(
  String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?` +
    NAME +
    String.raw`[^;]*?\badd\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?"?tenant_id"?\s`,
  "gi",
);
// A real DROP TABLE statement (not "ALTER PUBLICATION ... DROP TABLE").
const DROP_RE = new RegExp(
  String.raw`(?:^|;)\s*drop\s+table\s+(?:if\s+exists\s+)?` + NAME,
  "gi",
);

/** Public tables whose migrations give them a tenant_id column (in file order). */
export function tenantTablesFromSql(sqlTexts: string[]): Set<string> {
  const tables = new Set<string>();
  for (const raw of sqlTexts) {
    const sql = stripSqlComments(raw);
    // Only public-schema (or unqualified) tables.
    const events: Array<[number, "add" | "drop", string]> = [];
    for (const m of sql.matchAll(CREATE_RE)) {
      if (/\b(?:auth|storage|realtime|vault|supabase_functions)\s*\.\s*$/i.test(sql.slice(0, m.index! + m[0].indexOf(m[1]))))
        continue;
      const body = balancedBody(sql, m.index! + m[0].length - 1);
      if (/(^|[\s,(])"?tenant_id"?\s+\w/i.test(body)) events.push([m.index!, "add", m[1].toLowerCase()]);
    }
    for (const m of sql.matchAll(ALTER_ADD_RE)) events.push([m.index!, "add", m[1].toLowerCase()]);
    for (const m of sql.matchAll(DROP_RE)) events.push([m.index!, "drop", m[1].toLowerCase()]);
    for (const [, kind, name] of events.sort((a, b) => a[0] - b[0])) {
      if (kind === "add") tables.add(name);
      else tables.delete(name);
    }
  }
  return tables;
}

export function tenantTablesInMigrations(root = process.cwd()): Set<string> {
  const files = MIGRATION_DIRS.flatMap((d) => sqlFiles(path.join(root, d)));
  return tenantTablesFromSql(files.map((f) => fs.readFileSync(f, "utf8")));
}

/** Reads the string entries of `const NAME = [ ... ]` or `new Set([ ... ])` in a source file. */
export function readStringList(source: string, constName: string): Set<string> {
  const start = source.search(new RegExp(String.raw`const\s+${constName}\b[^=]*=`));
  if (start < 0) throw new Error(`${constName} not found`);
  const open = source.indexOf("[", start);
  const body = balancedSquare(source, open);
  const out = new Set<string>();
  for (const m of stripJsComments(body).matchAll(/["'`]([a-z_][a-z0-9_]*)["'`]/g)) out.add(m[1]);
  return out;
}

/** Reads the keys of `const NAME: Record<...> = { key: "...", ... }`. */
export function readRecordKeys(source: string, constName: string): Set<string> {
  const start = source.search(new RegExp(String.raw`const\s+${constName}\b[^=]*=`));
  if (start < 0) throw new Error(`${constName} not found`);
  const open = source.indexOf("{", source.indexOf("=", start));
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) { end = i; break; }
  }
  const body = stripJsComments(source.slice(open + 1, end));
  const out = new Set<string>();
  for (const m of body.matchAll(/(?:^|[,{\s])["']?([a-z_][a-z0-9_]*)["']?\s*:/g)) out.add(m[1]);
  return out;
}

function stripJsComments(s: string) {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}
function balancedSquare(s: string, open: number) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "[") depth++;
    else if (s[i] === "]" && --depth === 0) return s.slice(open + 1, i);
  }
  throw new Error("unterminated list");
}

export function coverageGaps(input: {
  migrationTables: Set<string>;
  rlsTestTables: Set<string>;
  otherSuiteTables: Set<string>;
  excluded: Set<string>;
}): string[] {
  return [...input.migrationTables]
    .filter((t) => !input.rlsTestTables.has(t) && !input.otherSuiteTables.has(t) && !input.excluded.has(t))
    .sort();
}
