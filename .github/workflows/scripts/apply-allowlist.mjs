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

let blocking = 0;
let waived = 0;
const reportedRules = new Set();

for (const adv of advisories) {
  if (severityRank(adv.severity) < minRank) continue;
  // Dedup notifications so the same advisory does not annotate the
  // PR multiple times when it appears via several install paths.
  if (reportedRules.has(adv.ruleId)) continue;
  reportedRules.add(adv.ruleId);

  const waiver = matchAllowlist(adv);
  if (waiver) {
    waived += 1;
    const reason = waiver.reason ? ` Reason: ${waiver.reason}` : "";
    console.log(
      `::warning title=Allowlisted advisory::${adv.pkg} ${adv.ruleId} (${adv.severity}) waived until ${waiver.expires}.${reason}`,
    );
  } else {
    blocking += 1;
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
  `Allowlist gate summary: ${blocking} blocking, ${waived} waived, ${expiredEntries.length} expired allowlist entry/entries.`,
);

if (blocking > 0) {
  console.error(
    `::error::${blocking} dependency advisory/advisories at severity '${level}' or higher are not on the allowlist.`,
  );
  process.exit(1);
}
process.exit(0);
