#!/usr/bin/env node
/**
 * Migration smoke check: fail CI if any 2-arg overload of
 *   public.has_permission / public.has_tenant_role
 * reappears in migrations OR is referenced from any call site
 * (SQL migrations, edge functions, frontend src).
 *
 * The canonical signatures are 3-arg only:
 *   has_permission(p_user_id uuid, p_permission text, p_tenant_id uuid)
 *   has_tenant_role(p_user_id uuid, p_role app_role, p_tenant_id uuid)
 *
 * A "2-arg call" is detected by counting top-level commas inside the
 * first balanced parenthesis group following the function name.
 *
 * Optionally, when SUPABASE_DB_URL (or PGHOST/PGUSER/PGPASSWORD/PGDATABASE)
 * is present, also assert via pg_proc that no 2-arg overload exists in the
 * live database. Without DB access this step is skipped (not failed).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
// Current code is scanned in full. Migrations are append-only history
// and historically contained 2-arg overloads/calls, so we only flag
// migrations newer than the drop baseline below.
const SCAN_DIRS = [
  "supabase/functions",
  "src",
  "scripts",
];

// Migration filename (YYYYMMDDHHMMSS prefix) at which the legacy
// 2-arg overloads were dropped. Any migration with a STRICTLY GREATER
// timestamp must not reintroduce a 2-arg overload or call site.
const MIGRATION_BASELINE = "20260511132118";
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".git",
  "coverage",
  "reports",
]);
const TEXT_EXT = /\.(sql|ts|tsx|js|jsx|mjs|cjs|md)$/i;

const FNS = ["has_permission", "has_tenant_role"];

// Files that are explicitly *about* this rule and may legitimately mention
// the legacy 2-arg shape (regression tests, this checker, audit notes).
const ALLOWLIST = [
  "scripts/ci/check-permission-arity.mjs",
  "supabase/functions/_shared/permission-checks-rls.test.ts",
];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIR_NAMES.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && TEXT_EXT.test(e.name)) yield full;
  }
}

/**
 * Returns the offsets of every call to `name(` whose top-level argument
 * list contains exactly `argCount - 1` commas (i.e. `argCount` args).
 * Skips matches that are part of a longer identifier (e.g. user_has_permission).
 */
function findCallsWithArity(src, name, argCount) {
  const hits = [];
  const needle = name + "(";
  let i = 0;
  while ((i = src.indexOf(needle, i)) !== -1) {
    const before = i === 0 ? "" : src[i - 1];
    if (/[A-Za-z0-9_]/.test(before)) { i += needle.length; continue; }
    // Walk balanced parens, counting top-level commas.
    let depth = 0;
    let commas = 0;
    let inS = false, inD = false, inDollar = false;
    let j = i + needle.length - 1; // points at "("
    let nonWhitespaceSeen = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (inS) { if (c === "'") inS = false; continue; }
      if (inD) { if (c === '"') inD = false; continue; }
      if (c === "'") { inS = true; continue; }
      if (c === '"') { inD = true; continue; }
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) { j++; break; }
      } else if (c === "," && depth === 1) {
        commas++;
      } else if (depth === 1 && /\S/.test(c)) {
        nonWhitespaceSeen = true;
      }
    }
    const args = nonWhitespaceSeen ? commas + 1 : 0;
    if (args === argCount) {
      // Compute line/col.
      const pre = src.slice(0, i);
      const line = pre.split("\n").length;
      const col = i - pre.lastIndexOf("\n");
      hits.push({ offset: i, line, col, snippet: src.slice(i, Math.min(src.length, j + 1)) });
    }
    i = j > i ? j : i + needle.length;
  }
  return hits;
}

function scanRepo() {
  const offenders = [];
  for (const d of SCAN_DIRS) {
    const abs = join(ROOT, d);
    try { statSync(abs); } catch { continue; }
    for (const f of walk(abs)) {
      const rel = relative(ROOT, f).split(sep).join("/");
      if (ALLOWLIST.includes(rel)) continue;
      const src = readFileSync(f, "utf8");
      for (const fn of FNS) {
        if (!src.includes(fn + "(")) continue;
        const twoArg = findCallsWithArity(src, fn, 2);
        for (const h of twoArg) {
          offenders.push({ file: rel, fn, line: h.line, col: h.col, snippet: h.snippet.replace(/\s+/g, " ").slice(0, 160) });
        }
      }
    }
  }
  return offenders;
}

function migrationTimestamp(name) {
  const m = name.match(/^(\d{14})/);
  return m ? m[1] : null;
}

function checkNewMigrations(offenders) {
  // For migrations newer than the baseline (i.e. added after the
  // legacy 2-arg overloads were dropped), forbid both CREATE of a 2-arg
  // overload AND any 2-arg call site. Older migrations are immutable
  // history and are not scanned here.
  const migDir = join(ROOT, "supabase/migrations");
  let entries;
  try { entries = readdirSync(migDir); } catch { return offenders; }
  for (const name of entries) {
    if (!name.endsWith(".sql")) continue;
    const ts = migrationTimestamp(name);
    if (!ts || ts <= MIGRATION_BASELINE) continue;
    const rel = `supabase/migrations/${name}`;
    const src = readFileSync(join(migDir, name), "utf8");

    for (const fn of FNS) {
      const re = new RegExp(
        String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?${fn}\s*\(([^)]*)\)`,
        "gi",
      );
      let m;
      while ((m = re.exec(src)) !== null) {
        const argList = m[1].trim();
        const argCount = argList === "" ? 0 : argList.split(",").length;
        if (argCount === 2) {
          const line = src.slice(0, m.index).split("\n").length;
          offenders.push({
            file: rel,
            fn,
            line,
            col: 1,
            snippet: `CREATE FUNCTION ${fn}(${argList})  <-- 2-arg overload forbidden`,
          });
        }
      }

      if (!src.includes(fn + "(")) continue;
      for (const h of findCallsWithArity(src, fn, 2)) {
        offenders.push({
          file: rel,
          fn,
          line: h.line,
          col: h.col,
          snippet: h.snippet.replace(/\s+/g, " ").slice(0, 160),
        });
      }
    }
  }
  return offenders;
}

async function checkLiveDb() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  const hasPgEnv = !!(process.env.PGHOST && process.env.PGUSER);
  if (!url && !hasPgEnv) {
    console.log("[arity-check] No SUPABASE_DB_URL / PG* env, skipping live DB probe.");
    return [];
  }
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.log("[arity-check] 'pg' not installed, skipping live DB probe.");
    return [];
  }
  const { Client } = pg.default ?? pg;
  const client = new Client(url ? { connectionString: url } : {});
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT p.proname,
              pg_get_function_identity_arguments(p.oid) AS args,
              p.pronargs
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('has_permission','has_tenant_role')`,
    );
    const bad = rows.filter((r) => r.pronargs === 2);
    return bad.map((r) => ({
      file: "<live db>",
      fn: r.proname,
      line: 0,
      col: 0,
      snippet: `2-arg overload present: ${r.proname}(${r.args})`,
    }));
  } finally {
    await client.end().catch(() => {});
  }
}

(async () => {
  let offenders = scanRepo();
  offenders = checkNewMigrations(offenders);
  const liveOffenders = await checkLiveDb();
  offenders.push(...liveOffenders);

  if (offenders.length === 0) {
    console.log(
      "[arity-check] OK: no 2-arg has_permission / has_tenant_role calls or overloads found.",
    );
    process.exit(0);
  }

  console.error(
    `[arity-check] FAIL: found ${offenders.length} forbidden 2-arg reference(s).`,
  );
  console.error(
    "  Canonical signatures are 3-arg only and require an explicit tenant_id.",
  );
  for (const o of offenders) {
    console.error(`  - ${o.file}:${o.line}:${o.col}  ${o.fn}  ${o.snippet}`);
  }
  process.exit(1);
})().catch((err) => {
  console.error("[arity-check] Unexpected error:", err);
  process.exit(2);
});
