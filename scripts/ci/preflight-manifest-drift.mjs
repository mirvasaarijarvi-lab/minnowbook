#!/usr/bin/env node
// Lightweight preflight: compares the declared specifiers in package.json
// against what bun.lock and package-lock.json claim the workspace asked
// for. Catches the exact drift class that has bitten CI repeatedly
// (`bun install --frozen-lockfile` exiting non-zero, npm refusing to
// install, @types/node / dompurify pin disagreements) BEFORE we waste a
// network install resolving anything.
//
// Usage:
//   node scripts/ci/preflight-manifest-drift.mjs           # exits 1 on drift
//   node scripts/ci/preflight-manifest-drift.mjs --json    # machine-readable
//
// Importable for tests:
//   import { collectDrift } from "./preflight-manifest-drift.mjs";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

/** bun.lock is JSONC: in practice the only non-JSON tokens bun emits
 * are trailing commas before `}` / `]`. Strip them and `JSON.parse`.
 * We deliberately do NOT strip `//` comments because string values in
 * the lockfile contain unquoted `https://...` URLs that a naive
 * comment-stripper would mangle. */
function stripJsoncToJson(text) {
  return text.replace(/,(\s*[}\]])/g, "$1");
}

/** Parse the top-level workspace deps recorded inside bun.lock (text v1). */
export function parseBunLock(text) {
  const json = JSON.parse(stripJsoncToJson(text));
  const ws = json.workspaces?.[""] ?? {};
  return {
    dependencies: ws.dependencies ?? {},
    devDependencies: ws.devDependencies ?? {},
  };
}

/** Parse the workspace-root entry from an npm v3 lockfile. */
export function parseNpmLock(text) {
  const json = JSON.parse(text);
  const root = json.packages?.[""] ?? {};
  return {
    dependencies: root.dependencies ?? {},
    devDependencies: root.devDependencies ?? {},
  };
}

/** Diff two `{name: range}` maps; returns sorted drift records. */
function diffSpecs(label, expected, actual) {
  const drifts = [];
  const names = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const name of [...names].sort()) {
    const want = expected[name];
    const got = actual[name];
    if (want === got) continue;
    if (want === undefined) {
      drifts.push({ source: label, name, kind: "extra-in-lockfile", expected: null, actual: got });
    } else if (got === undefined) {
      drifts.push({ source: label, name, kind: "missing-in-lockfile", expected: want, actual: null });
    } else {
      drifts.push({ source: label, name, kind: "range-mismatch", expected: want, actual: got });
    }
  }
  return drifts;
}

export function collectDrift({ root = REPO_ROOT } = {}) {
  const pkgPath = join(root, "package.json");
  const bunPath = join(root, "bun.lock");
  const npmPath = join(root, "package-lock.json");

  if (!existsSync(pkgPath)) {
    return { ok: false, fatal: `package.json missing at ${pkgPath}`, drifts: [] };
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const expected = {
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
  };

  const drifts = [];
  const checked = [];

  if (existsSync(bunPath)) {
    const bun = parseBunLock(readFileSync(bunPath, "utf8"));
    drifts.push(...diffSpecs("bun.lock:dependencies", expected.dependencies, bun.dependencies));
    drifts.push(...diffSpecs("bun.lock:devDependencies", expected.devDependencies, bun.devDependencies));
    checked.push("bun.lock");
  }
  if (existsSync(npmPath)) {
    const npm = parseNpmLock(readFileSync(npmPath, "utf8"));
    drifts.push(...diffSpecs("package-lock.json:dependencies", expected.dependencies, npm.dependencies));
    drifts.push(...diffSpecs("package-lock.json:devDependencies", expected.devDependencies, npm.devDependencies));
    checked.push("package-lock.json");
  }

  return { ok: drifts.length === 0, checked, drifts };
}

function formatReport(result) {
  if (result.fatal) return `preflight: ${result.fatal}`;
  if (result.ok) {
    return `preflight: package.json in sync with ${result.checked.join(" + ") || "(no lockfiles)"} ✓`;
  }
  const lines = [
    `preflight: dependency drift detected (${result.drifts.length} entr${result.drifts.length === 1 ? "y" : "ies"}):`,
    "",
  ];
  for (const d of result.drifts) {
    if (d.kind === "missing-in-lockfile") {
      lines.push(`  [${d.source}] ${d.name}: declared "${d.expected}" but lockfile has no entry`);
    } else if (d.kind === "extra-in-lockfile") {
      lines.push(`  [${d.source}] ${d.name}: lockfile pins "${d.actual}" but package.json does not list it`);
    } else {
      lines.push(`  [${d.source}] ${d.name}: package.json="${d.expected}" lockfile="${d.actual}"`);
    }
  }
  lines.push("", "Fix locally:");
  lines.push("  bun install --save-text-lockfile   # regenerate bun.lock");
  lines.push("  npm install --package-lock-only    # regenerate package-lock.json");
  lines.push("Then commit the updated lockfiles.");
  return lines.join("\n");
}

// CLI entry point — only run when invoked directly, not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = collectDrift();
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(result) + "\n");
  }
  process.exit(result.ok && !result.fatal ? 0 : 1);
}

export { formatReport };
