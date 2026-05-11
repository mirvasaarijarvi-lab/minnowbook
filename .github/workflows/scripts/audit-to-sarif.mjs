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

const [, , manager, inputPath, outputPath, lockfile] = process.argv;
if (!manager || !inputPath || !outputPath || !lockfile) {
  console.error("Usage: audit-to-sarif.mjs <manager> <input.json> <output.sarif> <lockfile>");
  process.exit(2);
}

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

// Normalised advisory shape used to build SARIF results.
//   { ruleId, pkg, severity, title, url, range }
const advisories = [];

function pushAdvisory({ ruleId, pkg, severity, title, url, range }) {
  const sev = String(severity || "info").toLowerCase();
  advisories.push({
    ruleId: String(ruleId || `${pkg}:${title || "unknown"}`),
    pkg: String(pkg || "unknown"),
    severity: sev,
    title: String(title || `Vulnerability in ${pkg}`),
    url: String(url || (ruleId ? `https://github.com/advisories/${ruleId}` : "https://github.com/advisories")),
    range: String(range || "unknown"),
  });
}

function parseNpm(report) {
  // npm v7+ shape: { vulnerabilities: { <pkg>: { severity, via: [...] } } }
  //
  // Each entry's `via` array can mix two element kinds:
  //   1. Advisory objects: { source, name, title, url, severity, range }
  //      where `name` is the package the advisory directly targets.
  //   2. Strings: the name of an upstream package (also present as a
  //      key in `vulnerabilities`) that transitively pulls in the
  //      vulnerable code. The actual advisory data for those lives on
  //      the upstream entry, not here.
  //
  // Naive iteration emits one SARIF result per (consumer-package,
  // advisory) pair, which produces N copies of the same advisory when
  // N packages depend on the vulnerable one. We only want one result
  // per (advisory, root-vulnerable-package), so:
  //   - Skip string `via` entries (the advisory is reachable via the
  //     upstream entry that owns the object form).
  //   - Use `v.name` (the package the advisory actually targets) as
  //     the canonical pkg, falling back to the current key.
  //   - Dedup on `${ruleId}::${canonicalPkg}` so multiple consumers of
  //     the same upstream do not multiply results.
  //   - Dedup advisory objects within a single via[] by ruleId too,
  //     in case npm lists the same source twice with different ranges.
  const vulns = report.vulnerabilities || {};
  const seen = new Set();
  for (const [pkgName, info] of Object.entries(vulns)) {
    const via = Array.isArray(info.via) ? info.via : [];
    for (const v of via) {
      if (typeof v !== "object" || v === null) continue;
      const canonicalPkg = String(v.name || pkgName);
      const ruleId = String(v.source ?? v.url ?? `${canonicalPkg}:${v.title ?? "unknown"}`);
      const dedupKey = `${ruleId}::${canonicalPkg}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      pushAdvisory({
        ruleId,
        pkg: canonicalPkg,
        severity: v.severity || info.severity,
        title: v.title,
        url: v.url,
        range: v.range,
      });
    }
  }
}

function parsePnpm(report) {
  // pnpm audit --json emits the npm v6 shape: { advisories: { <id>: {...} } }
  // Newer pnpm releases (>=9) sometimes mirror npm v7 with { vulnerabilities }.
  if (report.vulnerabilities && !report.advisories) {
    parseNpm(report);
    return;
  }
  const adv = report.advisories || {};
  for (const [id, a] of Object.entries(adv)) {
    pushAdvisory({
      ruleId: a.github_advisory_id || a.cves?.[0] || id,
      pkg: a.module_name,
      severity: a.severity,
      title: a.title,
      url: a.url,
      range: a.vulnerable_versions,
    });
  }
}

function parseYarnClassic(text) {
  // yarn classic --json emits one JSON object per line. We only care
  // about `auditAdvisory` records; `auditSummary` is skipped.
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    if (obj.type !== "auditAdvisory" || !obj.data?.advisory) continue;
    const a = obj.data.advisory;
    pushAdvisory({
      ruleId: a.github_advisory_id || a.cves?.[0] || a.id,
      pkg: a.module_name,
      severity: a.severity,
      title: a.title,
      url: a.url,
      range: a.vulnerable_versions,
    });
  }
}

function parseYarnBerry(report) {
  // yarn berry `yarn npm audit --json` shape: { advisories: { <id>: {...} } }
  // Same fields as the npm v6 / pnpm shape.
  parsePnpm(report);
}

let driverName;
let driverInfoUri;
switch (manager) {
  case "npm":
    driverName = "npm-audit";
    driverInfoUri = "https://docs.npmjs.com/cli/v10/commands/npm-audit";
    parseNpm(safeJson(raw));
    break;
  case "pnpm":
    driverName = "pnpm-audit";
    driverInfoUri = "https://pnpm.io/cli/audit";
    parsePnpm(safeJson(raw));
    break;
  case "yarn-classic":
    driverName = "yarn-audit";
    driverInfoUri = "https://classic.yarnpkg.com/lang/en/docs/cli/audit/";
    parseYarnClassic(raw);
    break;
  case "yarn-berry":
    driverName = "yarn-npm-audit";
    driverInfoUri = "https://yarnpkg.com/cli/npm/audit";
    parseYarnBerry(safeJson(raw));
    break;
  default:
    console.error(`Unknown manager: ${manager}`);
    process.exit(2);
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return {}; }
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
  results.push({
    ruleId: a.ruleId,
    level,
    message: { text: `${a.pkg}: ${a.title} (range ${a.range})` },
    locations: [{
      physicalLocation: {
        artifactLocation: { uri: lockfile },
        region: { startLine: 1 },
      },
    }],
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
      },
    },
    results,
  }],
};

fs.writeFileSync(outputPath, JSON.stringify(sarif));
console.log(`Wrote ${outputPath} with ${results.length} result(s) across ${rules.size} rule(s) for ${manager}.`);
