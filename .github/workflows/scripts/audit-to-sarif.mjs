#!/usr/bin/env node
// Convert a package-manager audit JSON report into minimal SARIF 2.1.0
// for GitHub code scanning.
//
// Usage:
//   node audit-to-sarif.mjs <manager> <input.json> <output.sarif> <lockfile>
//
// Supported managers: npm, pnpm, yarn-classic, yarn-berry
//
// Why one script for all managers:
//   Each manager emits a different JSON shape (npm v7+: { vulnerabilities },
//   pnpm: { advisories } or { vulnerabilities }, yarn classic: NDJSON of
//   { type: "auditAdvisory", data: { advisory } }, yarn berry: { advisories }).
//   Centralising the shape-normalisation here keeps the workflow YAML
//   small and ensures every manager produces the same SARIF rule shape,
//   so code-scanning de-duplicates advisories across runs cleanly.

import fs from "node:fs";
import { resolve, relative, isAbsolute, basename } from "node:path";
import { parseAuditReport, DRIVERS } from "./parse-audit.mjs";

// Defense-in-depth: this script only runs in CI on workflow-supplied
// paths (audit JSON + lockfile inside the checkout), but we still
// refuse to read anything outside the repo root in case a workflow is
// ever misconfigured to pass an absolute or traversal path.
function safeResolveWithin(input, root = process.cwd()) {
  const absRoot = resolve(root);
  const absPath = resolve(absRoot, input);
  const rel = relative(absRoot, absPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Refusing to read path outside repo root: ${input}`);
  }
  return absPath;
}

const [, , manager, inputPathArg, outputPathArg, lockfileArg, levelArg] = process.argv;
if (!manager || !inputPathArg || !outputPathArg || !lockfileArg) {
  console.error("Usage: audit-to-sarif.mjs <manager> <input.json> <output.sarif> <lockfile> [audit_level]");
  process.exit(2);
}
const inputPath = safeResolveWithin(inputPathArg);
const outputPath = safeResolveWithin(outputPathArg);
const lockfile = safeResolveWithin(lockfileArg);

// Resolved gate threshold for this run. Captured into SARIF metadata
// (run.properties.auditLevel + driver.properties.auditLevel) so anyone
// inspecting code-scanning alerts can see which severity floor was in
// effect when the SARIF was produced. Falls back to env to keep call
// sites in the workflow short, then to "unknown" if neither is set.
const auditLevel = String(levelArg || process.env.AUDIT_LEVEL || "unknown").toLowerCase();

if (!fs.existsSync(inputPath) || fs.statSync(inputPath).size === 0) {
  console.log(`${inputPath} missing or empty, skipping SARIF conversion.`);
  process.exit(0);
}

const raw = fs.readFileSync(inputPath, "utf8");

// Severity (string) to SARIF level + GitHub security-severity score.
const sevToLevel = {
  critical: "error",
  high: "error",
  moderate: "warning",
  medium: "warning",
  low: "note",
  info: "note",
  none: "note",
};
const sevToScore = {
  critical: "9.5",
  high: "8.0",
  moderate: "5.5",
  medium: "5.5",
  low: "3.5",
  info: "1.0",
  none: "1.0",
};

const advisories = parseAuditReport(manager, raw);
const driver = DRIVERS[manager];
if (!driver) {
  console.error(`Unknown manager: ${manager}`);
  process.exit(2);
}
const driverName = driver.name;
const driverInfoUri = driver.informationUri;

// ---------------------------------------------------------------
// Lockfile -> line-number index.
//
// SARIF results need a physical location to render inline on the
// "Files changed" tab. A fixed startLine=1 collapses every advisory
// onto the first line of the lockfile, which is useless. We scan the
// lockfile once and build a map { packageName -> [lineNumber, ...] }
// covering the three formats we emit SARIF for:
//
//   - npm package-lock.json v2/v3: keys like
//       "node_modules/lodash":   { ... }
//       "node_modules/@scope/x": { ... }
//     and v1's nested "<name>": { "version": ... } form.
//   - yarn.lock (v1): block headers like
//       "lodash@^4.17.0", "lodash@^4.17.21":
//   - pnpm-lock.yaml (v6+): keys like
//       /lodash@4.17.21:
//       '/@scope/x@1.0.0':
//
// Each result then emits one location per occurrence (capped at 10
// to keep payloads small for packages with many install paths). When
// no match is found we fall back to startLine=1 with a comment in
// the message so reviewers can spot the misindex.
// ---------------------------------------------------------------
// Allowlist of lockfile basenames we are willing to read. Defense-in-depth
// against a misconfigured workflow passing an arbitrary file path: even
// though safeResolveWithin() already confines reads to the repo root, we
// additionally refuse anything that isn't a recognised lockfile name and
// cap the read size so a hostile/oversized file can't exhaust memory.
const ALLOWED_LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
]);
const MAX_LOCKFILE_BYTES = 32 * 1024 * 1024; // 32 MiB

function buildLockfileIndex(lockfilePath) {
  const map = new Map();
  if (!lockfilePath) return map;
  const name = basename(lockfilePath);
  if (!ALLOWED_LOCKFILE_NAMES.has(name)) {
    console.warn(`Refusing to read non-lockfile path: ${name}`);
    return map;
  }
  if (!fs.existsSync(lockfilePath)) return map;
  const stat = fs.statSync(lockfilePath);
  if (!stat.isFile()) {
    console.warn(`Refusing to read non-regular lockfile: ${lockfilePath}`);
    return map;
  }
  if (stat.size > MAX_LOCKFILE_BYTES) {
    console.warn(`Lockfile exceeds size cap (${stat.size} bytes), skipping index.`);
    return map;
  }
  const text = fs.readFileSync(lockfilePath, "utf8");
  const lines = text.split(/\r?\n/);

  const extractors = [
    // npm package-lock v2/v3
    (line) => {
      const m = /^\s*"node_modules\/((?:@[^"/]+\/)?[^"]+)"\s*:/.exec(line);
      return m ? [m[1]] : [];
    },
    // npm package-lock v1 / generic JSON object key opening a block
    (line) => {
      const m = /^\s*"((?:@[^"/]+\/)?[A-Za-z0-9._-]+)"\s*:\s*\{/.exec(line);
      return m ? [m[1]] : [];
    },
    // yarn.lock v1 block header: one or more "<pkg>@<range>" comma-
    // separated, line ends with `:`. We extract every name in the
    // header so a single advisory points at all version-range groups.
    (line) => {
      if (!/:\s*$/.test(line)) return [];
      const names = [];
      const re = /"?((?:@[^@",]+\/)?[A-Za-z0-9._-]+)@[^",:]+"?/g;
      let m;
      while ((m = re.exec(line)) !== null) names.push(m[1]);
      return names;
    },
    // pnpm-lock.yaml v6+
    (line) => {
      const m = /^\s*'?\/((?:@[^/@]+\/)?[A-Za-z0-9._-]+)@[^':\s]+'?\s*:/.exec(line);
      return m ? [m[1]] : [];
    },
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const fn of extractors) {
      const names = fn(lines[i]);
      for (const name of names) {
        const arr = map.get(name) || [];
        if (!arr.includes(i + 1)) arr.push(i + 1);
        map.set(name, arr);
      }
    }
  }
  return map;
}

const MAX_LOCATIONS_PER_RESULT = 10;
const lockfileIndex = buildLockfileIndex(lockfile);

function locationsFor(pkg) {
  const lines = lockfileIndex.get(pkg) || [];
  if (lines.length === 0) {
    // Last-resort fallback: anchor at the top of the lockfile so the
    // SARIF stays valid and the result still surfaces. This typically
    // means the advisory targets a virtual / metapackage that is not
    // a real key in the lockfile.
    return [{
      physicalLocation: {
        artifactLocation: { uri: lockfile },
        region: { startLine: 1 },
      },
    }];
  }
  return lines.slice(0, MAX_LOCATIONS_PER_RESULT).map((ln) => ({
    physicalLocation: {
      artifactLocation: { uri: lockfile },
      region: { startLine: ln },
    },
  }));
}

const rules = new Map();
const results = [];
for (const a of advisories) {
  const level = sevToLevel[a.severity] || "note";
  if (!rules.has(a.ruleId)) {
    rules.set(a.ruleId, {
      id: a.ruleId,
      name: a.title.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80) || "advisory",
      shortDescription: { text: a.title.slice(0, 120) },
      fullDescription: { text: a.title },
      helpUri: a.url,
      help: { text: `${a.title}\nSee: ${a.url}`, markdown: `**${a.title}**\n\nSee: [${a.url}](${a.url})` },
      defaultConfiguration: { level },
      properties: {
        "security-severity": sevToScore[a.severity] || "1.0",
        tags: ["security", "dependency", a.severity],
      },
    });
  }
  const locs = locationsFor(a.pkg);
  const anchored = locs.length > 0 && (lockfileIndex.get(a.pkg)?.length || 0) > 0;
  results.push({
    ruleId: a.ruleId,
    level,
    message: {
      text: anchored
        ? `${a.pkg}: ${a.title} (range ${a.range})`
        : `${a.pkg}: ${a.title} (range ${a.range}) [lockfile entry not located, anchored at line 1]`,
    },
    locations: locs,
    partialFingerprints: { advisory: a.ruleId, package: a.pkg },
  });
}

const sarif = {
  $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  version: "2.1.0",
  runs: [{
    tool: {
      driver: {
        name: driverName,
        informationUri: driverInfoUri,
        version: "1.0",
        rules: Array.from(rules.values()),
        // Mirrored on the driver so tools that only render
        // tool.driver.properties (some SARIF viewers) still expose
        // the gate level next to the tool name.
        properties: {
          auditLevel,
          manager,
        },
      },
    },
    // run.properties is the canonical place for run-scoped metadata
    // in SARIF 2.1.0. Code scanning preserves these fields and they
    // appear in the alert details payload.
    properties: {
      auditLevel,
      auditLevelDescription: `Minimum severity that fails the dependency-audit gate. Advisories below '${auditLevel}' are present in the report but do not block the PR.`,
      manager,
      generatedAt: new Date().toISOString(),
    },
    results,
  }],
};

fs.writeFileSync(outputPath, JSON.stringify(sarif));
console.log(`Wrote ${outputPath} with ${results.length} result(s) across ${rules.size} rule(s) for ${manager} at AUDIT_LEVEL=${auditLevel}.`);
