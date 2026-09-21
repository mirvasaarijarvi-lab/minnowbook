#!/usr/bin/env node
// Turn package-manager audit JSON into a human-readable dependency-audit
// report, and (on pull requests) annotate only the advisories the PR
// actually introduces.
//
// Usage:
//   node audit-report.mjs --manager=npm --head=head.json \
//     [--base=base.json] --out-dir=audit-report [--allowlist=GHSA-a,GHSA-b] \
//     [--fail-on=high]
//
// Outputs inside --out-dir:
//   audit-report.md    Markdown report (also appended to the step summary)
//   audit-report.json  Machine-readable diff: new / fixed / pre-existing
//
// Why a base comparison: the repo carries a small documented allowlist of
// advisories that cannot be fixed yet. Annotating every known advisory on
// every PR trains reviewers to ignore the annotations. Diffing against the
// base branch's audit means a PR is only annotated for what it adds.

import fs from "node:fs";
import path from "node:path";
import { parseAuditReport, severityRank } from "./parse-audit.mjs";

export const BLOCKING_SEVERITIES = ["high", "critical"];

/** Stable identity for an advisory across two audit runs. */
export function advisoryKey(a) {
  return `${a.ghsaId || a.ruleId}::${a.pkg}`;
}

export function isAllowlisted(advisory, allowlist) {
  if (!allowlist.length) return false;
  const ids = [
    advisory.ruleId,
    advisory.ghsaId,
    advisory.url,
    ...(advisory.cves || []),
  ].filter(Boolean);
  return allowlist.some((entry) =>
    ids.some((id) => String(id).includes(entry)),
  );
}

/**
 * Compare a head audit against a base audit.
 * `base === null` means "no baseline available" (push, schedule, first run):
 * everything is reported as pre-existing so nothing is falsely blamed on
 * the pull request.
 */
export function diffAudits(headAdvisories, baseAdvisories, allowlist = []) {
  const decorate = (a) => ({ ...a, allowlisted: isAllowlisted(a, allowlist) });
  const head = headAdvisories.map(decorate);
  const hasBaseline = Array.isArray(baseAdvisories);
  const baseKeys = new Set((baseAdvisories || []).map(advisoryKey));
  const headKeys = new Set(head.map(advisoryKey));

  const introduced = hasBaseline
    ? head.filter((a) => !baseKeys.has(advisoryKey(a)))
    : [];
  const preExisting = hasBaseline
    ? head.filter((a) => baseKeys.has(advisoryKey(a)))
    : head;
  const fixed = hasBaseline
    ? (baseAdvisories || [])
        .filter((a) => !headKeys.has(advisoryKey(a)))
        .map(decorate)
    : [];

  const bySeverity = (list) =>
    [...list].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return {
    hasBaseline,
    introduced: bySeverity(introduced),
    preExisting: bySeverity(preExisting),
    fixed: bySeverity(fixed),
  };
}

/** Advisories the PR introduces that should fail the job. */
export function blockingAdvisories(diff, failOn = "high") {
  const floor = severityRank(failOn);
  return diff.introduced.filter(
    (a) => !a.allowlisted && severityRank(a.severity) >= floor,
  );
}

const SEVERITY_ICON = {
  critical: "🔴",
  high: "🟠",
  moderate: "🟡",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

function table(list) {
  if (!list.length) return "_None._\n";
  const rows = list.map((a) => {
    const icon = SEVERITY_ICON[a.severity] || "⚪";
    const id = a.ghsaId || a.ruleId;
    const link = a.url ? `[${id}](${a.url})` : id;
    const waived = a.allowlisted ? " _(allowlisted)_" : "";
    return `| ${icon} ${a.severity} | \`${a.pkg}\` | ${a.range} | ${link}${waived} | ${a.title} |`;
  });
  return [
    "| Severity | Package | Affected | Advisory | Title |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

export function renderMarkdown(diff, { manager, failOn, label }) {
  const counts = (list) =>
    BLOCKING_SEVERITIES.concat(["moderate", "low", "info"])
      .map((sev) => [sev, list.filter((a) => a.severity === sev).length])
      .filter(([, n]) => n > 0)
      .map(([sev, n]) => `${n} ${sev}`)
      .join(", ") || "none";

  const lines = [
    "## Dependency audit report",
    "",
    `- Source: \`${label || manager} audit\``,
    `- Failure threshold for newly introduced advisories: **${failOn} and above**`,
    `- Newly introduced: **${counts(diff.introduced)}**`,
    `- Pre-existing: ${counts(diff.preExisting)}`,
    `- Fixed by this change: ${counts(diff.fixed)}`,
    "",
  ];

  if (!diff.hasBaseline) {
    lines.push(
      "> No base-branch baseline was available for this run, so every advisory is listed as pre-existing.",
      "",
    );
  }

  lines.push("### Newly introduced", "", table(diff.introduced));
  lines.push("### Fixed by this change", "", table(diff.fixed));
  lines.push("### Pre-existing", "", table(diff.preExisting));
  return lines.join("\n");
}

/** GitHub workflow-command annotation lines. */
export function annotations(diff, failOn = "high") {
  const floor = severityRank(failOn);
  const out = [];
  for (const a of diff.introduced) {
    const id = a.ghsaId || a.ruleId;
    const detail = `${a.pkg}@${a.range} — ${a.title} (${id}, ${a.severity})`;
    if (a.allowlisted) {
      out.push(
        `::notice title=New allowlisted advisory::${detail}. Waived by the documented audit allowlist.`,
      );
    } else if (severityRank(a.severity) >= floor) {
      out.push(
        `::error title=New ${a.severity} advisory introduced::${detail}. Upgrade the dependency or add a documented allowlist entry.`,
      );
    } else {
      out.push(`::warning title=New ${a.severity} advisory introduced::${detail}`);
    }
  }
  return out;
}

function arg(name, fallback = "") {
  const hit = process.argv.slice(2).find((v) => v.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function readAudit(manager, file) {
  if (!file) return null;
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return null;
  return parseAuditReport(manager, fs.readFileSync(file, "utf8"));
}

function main() {
  const manager = arg("manager", "npm");
  const headFile = arg("head");
  const baseFile = arg("base");
  const outDir = arg("out-dir", "audit-report");
  const failOn = arg("fail-on", "high").toLowerCase();
  const label = arg("label");
  const allowlist = arg("allowlist")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const head = readAudit(manager, headFile) || [];
  const base = readAudit(manager, baseFile);
  const diff = diffAudits(head, base, allowlist);

  fs.mkdirSync(outDir, { recursive: true });
  const markdown = renderMarkdown(diff, { manager, failOn, label });
  fs.writeFileSync(path.join(outDir, "audit-report.md"), `${markdown}\n`);
  fs.writeFileSync(
    path.join(outDir, "audit-report.json"),
    `${JSON.stringify({ manager, failOn, allowlist, ...diff }, null, 2)}\n`,
  );

  for (const line of annotations(diff, failOn)) console.log(line);
  console.log(markdown);

  const summary = process.env["GITHUB_STEP_SUMMARY"];
  if (summary) fs.appendFileSync(summary, `${markdown}\n`);

  const blocking = blockingAdvisories(diff, failOn);
  if (blocking.length) {
    console.error(
      `::error::${blocking.length} newly introduced ${failOn}-or-above advisor(y/ies). See the dependency audit report artifact.`,
    );
    process.exit(1);
  }
}

// Only run the CLI when invoked directly, so tests can import the helpers.
if (process.argv[1] && process.argv[1].endsWith("audit-report.mjs")) main();
