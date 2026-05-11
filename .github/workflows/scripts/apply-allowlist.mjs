#!/usr/bin/env node
// Allowlist-aware dependency audit gate.
//
// Usage:
//   node apply-allowlist.mjs <manager> <audit-prod.json> <allowlist.json> <AUDIT_LEVEL>
//
// Behaviour:
//   1. Parse the audit JSON for the detected manager into the
//      normalised advisory shape (shared with the SARIF converter).
//   2. Drop every advisory whose severity is below AUDIT_LEVEL. The
//      gate only cares about advisories the project would otherwise
//      fail on.
//   3. For each remaining advisory, look up the allowlist:
//        - match by ruleId, GHSA id, or CVE id
//        - require `expires` to be a future UTC date (YYYY-MM-DD)
//      Matched advisories are reported as ::warning:: annotations
//      with the allowlist `reason` and expiry date so reviewers
//      know why the gate stayed green.
//   4. Anything not allowlisted is reported as a ::error:: and the
//      script exits with status 1.
//   5. Expired allowlist entries are reported as ::warning:: even
//      when the underlying advisory is no longer present, so stale
//      entries get cleaned up instead of silently lingering.
//
// Why a wrapper instead of `npm audit --omit=dev`:
//   `npm audit` only knows how to fail on severity, not on a
//   per-advisory waiver. To temporarily accept a known advisory
//   while a fix is in flight, we need an out-of-band allowlist
//   that a human can review and that auto-expires.

import fs from "node:fs";
import { parseAuditReport, severityRank } from "./parse-audit.mjs";

const [, , manager, auditPath, allowlistPath, levelArg] = process.argv;
if (!manager || !auditPath || !allowlistPath || !levelArg) {
  console.error("Usage: apply-allowlist.mjs <manager> <audit.json> <allowlist.json> <AUDIT_LEVEL>");
  process.exit(2);
}

const level = String(levelArg).toLowerCase();
if (!["low", "moderate", "high", "critical"].includes(level)) {
  console.error(`Invalid AUDIT_LEVEL: ${levelArg}`);
  process.exit(2);
}
const minRank = severityRank(level);

if (!fs.existsSync(auditPath) || fs.statSync(auditPath).size === 0) {
  console.log(`${auditPath} missing or empty, treating as no advisories.`);
  process.exit(0);
}

let allowlist = { entries: [] };
if (fs.existsSync(allowlistPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
    if (Array.isArray(parsed.entries)) allowlist = parsed;
  } catch (e) {
    console.error(`::error file=${allowlistPath}::Allowlist is not valid JSON: ${e.message}`);
    process.exit(2);
  }
}

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

function isActive(entry) {
  if (typeof entry.expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)) return false;
  const exp = new Date(`${entry.expires}T00:00:00Z`);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() >= today.getTime();
}

// Validate allowlist entries up front so a malformed entry is loud
// rather than silently disabling the waiver.
const seenIds = new Set();
for (const [i, entry] of (allowlist.entries || []).entries()) {
  const at = `entries[${i}]`;
  if (!entry || typeof entry !== "object") {
    console.error(`::error file=${allowlistPath}::${at} must be an object.`);
    process.exit(2);
  }
  if (typeof entry.id !== "string" || entry.id.length === 0) {
    console.error(`::error file=${allowlistPath}::${at}.id is required.`);
    process.exit(2);
  }
  if (typeof entry.expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)) {
    console.error(`::error file=${allowlistPath}::${at}.expires must be YYYY-MM-DD.`);
    process.exit(2);
  }
  if (seenIds.has(entry.id)) {
    console.error(`::error file=${allowlistPath}::${at}.id "${entry.id}" duplicates an earlier entry.`);
    process.exit(2);
  }
  seenIds.add(entry.id);
}

const activeEntries = allowlist.entries.filter(isActive);
const expiredEntries = allowlist.entries.filter((e) => !isActive(e));

// Index allowlist by every id form so a single advisory can be
// matched whether the entry was authored against the npm source id,
// the GHSA id, or a CVE id.
const allowById = new Map();
for (const e of activeEntries) allowById.set(String(e.id), e);

function matchAllowlist(adv) {
  const candidates = [adv.ruleId, adv.ghsaId, ...(adv.cves || [])].filter(Boolean).map(String);
  for (const c of candidates) {
    if (allowById.has(c)) return allowById.get(c);
  }
  return null;
}

const raw = fs.readFileSync(auditPath, "utf8");
const advisories = parseAuditReport(manager, raw);

const blocking = [];
const waivedEntries = [];
const reportedRules = new Set();

// Per-severity tallies fed into the GitHub PR check summary so the
// check title can read e.g. "AUDIT_LEVEL=high — 3 blocking
// (critical=1, high=2)" without the reviewer having to expand the
// step log. We track all four buckets even when they are below the
// gate threshold so the informational rows in the summary still
// show what is lurking in the dependency graph.
const SEVERITIES = ["critical", "high", "moderate", "low"];
const zeroCounts = () => Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
const blockingBySeverity = zeroCounts();
const waivedBySeverity = zeroCounts();
const totalBySeverity = zeroCounts();

function bumpSeverity(bucket, sev) {
  const key = String(sev || "").toLowerCase();
  const normalised = key === "medium" ? "moderate" : key;
  if (bucket[normalised] !== undefined) bucket[normalised] += 1;
}

for (const adv of advisories) {
  if (severityRank(adv.severity) < minRank) continue;
  // Dedup notifications so the same advisory does not annotate the
  // PR multiple times when it appears via several install paths.
  if (reportedRules.has(adv.ruleId)) continue;
  reportedRules.add(adv.ruleId);

  bumpSeverity(totalBySeverity, adv.severity);

  const waiver = matchAllowlist(adv);
  if (waiver) {
    waivedEntries.push({ adv, waiver });
    bumpSeverity(waivedBySeverity, adv.severity);
    const reason = waiver.reason ? ` Reason: ${waiver.reason}` : "";
    console.log(
      `::warning title=Allowlisted advisory::${adv.pkg} ${adv.ruleId} (${adv.severity}) waived until ${waiver.expires}.${reason}`,
    );
  } else {
    blocking.push(adv);
    bumpSeverity(blockingBySeverity, adv.severity);
    console.log(
      `::error title=Vulnerable dependency::${adv.pkg} ${adv.ruleId} (${adv.severity}): ${adv.title}. See ${adv.url}`,
    );
  }
}

for (const e of expiredEntries) {
  console.log(
    `::warning file=${allowlistPath},title=Expired allowlist entry::Allowlist entry id="${e.id}" expired on ${e.expires}. Remove it or extend the date.`,
  );
}

console.log(
  `Allowlist gate summary: ${blocking.length} blocking, ${waivedEntries.length} waived, ${expiredEntries.length} expired allowlist entry/entries.`,
);

// ---------------------------------------------------------------
// PR comment payload.
//
// Written to AUDIT_COMMENT_PATH (or audit-comment.md by default) as
// GitHub-flavoured markdown. The workflow's PR-comment step picks
// this up and upserts a sticky comment keyed on the marker below,
// so repeat runs replace the previous summary instead of stacking.
//
// We intentionally include the sticky marker comment INSIDE the
// markdown body so a human cannot accidentally break the upsert by
// editing the comment in the GitHub UI.
// ---------------------------------------------------------------
const STICKY_MARKER = "<!-- mimmobook:dependency-audit-comment -->";

function sevBadge(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "critical") return "🔴 critical";
  if (s === "high") return "🟠 high";
  if (s === "moderate" || s === "medium") return "🟡 moderate";
  if (s === "low") return "🔵 low";
  return "⚪ info";
}

function row(adv, extra = "") {
  const link = `[${adv.ruleId}](${adv.url})`;
  return `| ${sevBadge(adv.severity)} | \`${adv.pkg}\` | ${link} | ${adv.title.replace(/\|/g, "\\|")} | ${adv.range.replace(/\|/g, "\\|")} |${extra}`;
}

const lines = [];
lines.push(STICKY_MARKER);
lines.push(`## Dependency audit (${manager})`);
lines.push("");
const verdict = blocking.length === 0
  ? `**Result:** PASS at \`AUDIT_LEVEL=${level}\`.`
  : `**Result:** FAIL. ${blocking.length} advisory/advisories at severity \`${level}\` or higher are not on the allowlist.`;
lines.push(verdict);
lines.push("");
lines.push(`- Blocking: **${blocking.length}**`);
lines.push(`- Waived by allowlist: **${waivedEntries.length}**`);
lines.push(`- Expired allowlist entries: **${expiredEntries.length}**`);
lines.push("");

// Severity breakdown table. Mirrors the data published to the
// GitHub PR check run / step summary so a reviewer reading just the
// PR comment still sees how findings map onto the configured gate.
lines.push("### Severity breakdown");
lines.push("");
lines.push("| Severity | Blocking | Waived | Total at or above gate | Gate? |");
lines.push("| --- | ---: | ---: | ---: | :---: |");
for (const sev of SEVERITIES) {
  const atOrAboveGate = severityRank(sev) >= minRank;
  lines.push(
    `| ${sevBadge(sev)} | ${blockingBySeverity[sev]} | ${waivedBySeverity[sev]} | ${atOrAboveGate ? totalBySeverity[sev] : "—"} | ${atOrAboveGate ? "✅" : "·"} |`,
  );
}
lines.push("");
lines.push(`<sub>"Gate?" marks severities at or above \`AUDIT_LEVEL=${level}\` that count toward the pass/fail decision.</sub>`);
lines.push("");

if (blocking.length > 0) {
  lines.push(`### Failing against \`AUDIT_LEVEL=${level}\``);
  lines.push("");
  lines.push("| Severity | Package | Advisory | Title | Affected range |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const adv of blocking) lines.push(row(adv));
  lines.push("");
  lines.push(
    `Add an entry to \`.github/dependency-audit-allowlist.json\` with the advisory id, an \`expires\` date (YYYY-MM-DD, UTC), and a \`reason\` to temporarily waive the gate while a fix is in flight.`,
  );
  lines.push("");
}

if (waivedEntries.length > 0) {
  lines.push("### Waived by allowlist");
  lines.push("");
  lines.push("| Severity | Package | Advisory | Title | Affected range | Expires | Reason |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const { adv, waiver } of waivedEntries) {
    const reason = (waiver.reason || "").replace(/\|/g, "\\|");
    lines.push(`${row(adv)} ${waiver.expires} | ${reason} |`);
  }
  lines.push("");
}

if (expiredEntries.length > 0) {
  lines.push("### Expired allowlist entries");
  lines.push("");
  lines.push("| Id | Expired on | Reason |");
  lines.push("| --- | --- | --- |");
  for (const e of expiredEntries) {
    const reason = (e.reason || "").replace(/\|/g, "\\|");
    lines.push(`| \`${e.id}\` | ${e.expires} | ${reason} |`);
  }
  lines.push("");
  lines.push("These entries no longer waive their advisories. Remove them or extend the `expires` date.");
  lines.push("");
}

lines.push(
  `<sub>Generated by \`.github/workflows/dependency-audit.yml\`. AUDIT_LEVEL=\`${level}\`, manager=\`${manager}\`.</sub>`,
);

const commentPath = process.env.AUDIT_COMMENT_PATH || "audit-comment.md";
fs.writeFileSync(commentPath, lines.join("\n") + "\n");
console.log(`Wrote PR comment payload to ${commentPath} (${lines.length} lines).`);

// ---------------------------------------------------------------
// GitHub PR check integration.
//
// The job already shows up as a single required check
// ("dependency-audit"), but its title is just the job name. To make
// the gate result legible from the PR's "Checks" sidebar without
// expanding the run, we:
//
//   1. Emit step outputs (`audit_level`, `blocking_count`, the
//      per-severity tallies, etc.) so a downstream `actions/github-
//      script` step can create a sibling Check Run titled
//      "AUDIT_LEVEL=high — 3 blocking (critical=1, high=2)".
//
//   2. Append a Markdown summary to $GITHUB_STEP_SUMMARY with the
//      same severity breakdown that lands in the PR comment, so the
//      Actions run page surfaces it in-line.
//
//   3. Print a single ::notice:: with the headline. PR reviewers
//      who are already in the run log see the same one-liner.
// ---------------------------------------------------------------
const breakdownParts = SEVERITIES
  .filter((s) => severityRank(s) >= minRank)
  .map((s) => `${s}=${blockingBySeverity[s]}`);
const headline = `AUDIT_LEVEL=${level} — ${blocking.length} blocking (${breakdownParts.join(", ") || "none"}), ${waivedEntries.length} waived, ${expiredEntries.length} expired`;

function appendKV(target, key, value) {
  if (!target) return;
  // Use the heredoc form so multi-line values (none here, but safe)
  // never collide with the GitHub Actions parser.
  const delim = `EOF_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(target, `${key}<<${delim}\n${value}\n${delim}\n`);
}

const ghOutput = process.env.GITHUB_OUTPUT;
if (ghOutput) {
  appendKV(ghOutput, "audit_level", level);
  appendKV(ghOutput, "manager", manager);
  appendKV(ghOutput, "blocking_count", String(blocking.length));
  appendKV(ghOutput, "waived_count", String(waivedEntries.length));
  appendKV(ghOutput, "expired_count", String(expiredEntries.length));
  for (const sev of SEVERITIES) {
    appendKV(ghOutput, `blocking_${sev}`, String(blockingBySeverity[sev]));
    appendKV(ghOutput, `waived_${sev}`, String(waivedBySeverity[sev]));
    appendKV(ghOutput, `total_${sev}`, String(totalBySeverity[sev]));
  }
  appendKV(ghOutput, "headline", headline);
  // Used as the Check Run conclusion downstream.
  appendKV(ghOutput, "conclusion", blocking.length > 0 ? "failure" : "success");
}

const ghSummary = process.env.GITHUB_STEP_SUMMARY;
if (ghSummary) {
  fs.appendFileSync(ghSummary, lines.join("\n") + "\n");
}

console.log(`::notice title=Dependency audit::${headline}`);

if (blocking.length > 0) {
  console.error(
    `::error::${blocking.length} dependency advisory/advisories at severity '${level}' or higher are not on the allowlist.`,
  );
  process.exit(1);
}
process.exit(0);
