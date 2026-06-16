#!/usr/bin/env node
/**
 * Verifies that the npm lockfile resolves security-critical packages to
 * versions at or above a documented floor.
 *
 * Why this exists: `package.json` uses semver ranges in the `overrides`
 * block (e.g. `"js-yaml": ">=4.2.0"`), but the version actually used
 * by `npm ci` / `bun install --frozen-lockfile` is whatever the
 * committed lockfile resolves to. A stale lockfile can silently pin a
 * vulnerable version even after the override floor has been raised.
 *
 * This script reads `package-lock.json`, finds every install of each
 * floor-tracked package (including nested copies), and fails CI if any
 * resolution is below the documented minimum. It also asserts that the
 * `overrides` floor in `package.json` is at least the tracked minimum,
 * so the two never drift apart.
 *
 * To track a new package, add an entry to FLOORS below with the CVE /
 * advisory reference so future contributors understand the constraint.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

/**
 * Minimum installed version for each tracked package.
 * Bump these when a new patched release ships.
 */
const FLOORS = {
  "js-yaml": { min: "4.2.0", reason: "CVE-2026-53550 (merge-key DoS)" },
  // Add more security-critical packages here as needed, e.g.:
  //   ws:        { min: "8.21.0", reason: "ws DoS via tiny fragments" },
  //   esbuild:   { min: "0.28.1", reason: "esbuild Deno binary integrity advisory" },
  //   "form-data": { min: "4.0.6", reason: "form-data header injection" },
};

/**
 * Compare two semver strings. Returns negative if a < b, 0 if equal,
 * positive if a > b. Pre-release tags are treated as lower than the
 * matching release (good enough for floor comparison).
 */
function compareSemver(a, b) {
  const parse = (v) => {
    const [core, pre] = String(v).split("-", 2);
    const parts = core.split(".").map((n) => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return { parts, pre: pre ?? null };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa.parts[i] !== pb.parts[i]) return pa.parts[i] - pb.parts[i];
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1;
  if (pb.pre === null) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), "utf8"));
}

function findInstalledVersions(lockfile, pkgName) {
  const found = [];
  const packages = lockfile.packages ?? {};
  for (const [key, meta] of Object.entries(packages)) {
    // Lockfile keys look like "" (root), "node_modules/js-yaml",
    // "node_modules/foo/node_modules/js-yaml", etc.
    if (key === `node_modules/${pkgName}` || key.endsWith(`/node_modules/${pkgName}`)) {
      if (meta && typeof meta.version === "string") {
        found.push({ path: key || "<root>", version: meta.version });
      }
    }
  }
  return found;
}

/**
 * Extract the minimum version expressed by a simple semver range.
 * Supports `=x.y.z`, `x.y.z`, `>=x.y.z`, `^x.y.z`, `~x.y.z`. Returns
 * null for ranges we cannot statically interpret (e.g. `*`, alias
 * specs like `$dompurify`, git URLs).
 */
function rangeMinimum(range) {
  if (typeof range !== "string") return null;
  const trimmed = range.trim();
  const m = trimmed.match(/^(?:>=|=|\^|~)?\s*(\d+\.\d+\.\d+(?:-[\w.]+)?)$/);
  return m ? m[1] : null;
}

const pkgJson = readJson("package.json");
const lock = readJson("package-lock.json");

const errors = [];
const summary = [];

for (const [name, { min, reason }] of Object.entries(FLOORS)) {
  // 1. Lockfile resolutions (this is what actually gets installed).
  const installs = findInstalledVersions(lock, name);
  if (installs.length === 0) {
    summary.push(`  ${name}: not present in lockfile (skipping)`);
    continue;
  }
  for (const { path: where, version } of installs) {
    if (compareSemver(version, min) < 0) {
      errors.push(
        `${name}@${version} at ${where} is below the required floor ${min} (${reason})`,
      );
    }
  }

  // 2. Override floor in package.json (defense in depth: prevents the
  //    next `npm install` from silently downgrading the resolution).
  const overrideRange = pkgJson.overrides?.[name];
  const overrideMin = rangeMinimum(overrideRange);
  if (overrideRange && overrideMin && compareSemver(overrideMin, min) < 0) {
    errors.push(
      `package.json overrides["${name}"] = "${overrideRange}" allows versions below ${min} (${reason})`,
    );
  }

  const versions = [...new Set(installs.map((i) => i.version))].join(", ");
  summary.push(`  ${name}: floor ${min}, installed ${versions}`);
}

console.log("Security-floor check (lockfile vs documented minimums):");
for (const line of summary) console.log(line);

if (errors.length > 0) {
  console.error("");
  console.error("Lockfile drift detected:");
  for (const err of errors) console.error(`  - ${err}`);
  console.error("");
  console.error("Fix: bump the override in package.json, then run");
  console.error("  npm install --package-lock-only --ignore-scripts");
  console.error("  bun install");
  console.error("and commit the refreshed lockfiles.");
  process.exit(1);
}

console.log("\nAll tracked packages are at or above their security floor.");
