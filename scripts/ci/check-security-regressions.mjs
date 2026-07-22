#!/usr/bin/env node
/**
 * CI gate: cross-check the Supabase advisors payload against
 * .github/security-regression-baseline.json and fail on any match.
 *
 * A "match" means an advisor lint whose name (and optional schema/object
 * name / description) fits a previously-fixed finding or a class rule we
 * never want to reintroduce (e.g. rls_disabled_in_public, security_definer_view).
 *
 * Usage:
 *   cat advisors.json | node scripts/ci/check-security-regressions.mjs
 *   node scripts/ci/check-security-regressions.mjs --file advisors.json
 *
 * Exit codes:
 *   0 — no regression matches
 *   1 — at least one regression matched a baseline entry
 *   2 — bad input / bad baseline (invalid JSON, missing fields)
 *
 * The check is intentionally advisory-name-driven so it works with the
 * public advisors API (name, level, description, metadata). It does NOT
 * depend on Lovable's internal scanner IDs, which aren't reachable from CI.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASELINE_PATH = resolve(__dirname, "../../.github/security-regression-baseline.json");

function fail(msg, code = 2) {
  console.error(`::error title=Security regression check::${msg}`);
  process.exit(code);
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function loadInput() {
  const fileIdx = process.argv.indexOf("--file");
  let raw = "";
  if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
    raw = readFileSync(process.argv[fileIdx + 1], "utf8");
  } else {
    raw = readStdin();
  }
  if (!raw.trim()) fail("no advisors JSON on stdin or --file");
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`advisors payload is not valid JSON: ${e.message}`);
  }
}

function loadBaseline() {
  let raw;
  try {
    raw = readFileSync(BASELINE_PATH, "utf8");
  } catch (e) {
    fail(`baseline not readable at ${BASELINE_PATH}: ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`baseline is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(parsed.entries)) {
    fail("baseline.entries must be an array");
  }
  return parsed.entries.map((entry, i) => {
    if (!entry.id) fail(`baseline.entries[${i}] missing 'id'`);
    if (!entry.match || !entry.match.lint_name) {
      fail(`baseline entry '${entry.id}' missing match.lint_name`);
    }
    return {
      id: entry.id,
      severity_floor: entry.severity_floor === "ERROR" ? "ERROR" : "any",
      reference: entry.reference || "",
      matchers: {
        lint_name: buildMatcher(entry.match.lint_name),
        schema: entry.match.schema ? buildMatcher(entry.match.schema) : null,
        name: entry.match.name ? buildMatcher(entry.match.name) : null,
        description: entry.match.description
          ? buildMatcher(entry.match.description, { substring: true })
          : null,
      },
    };
  });
}

function buildMatcher(spec, { substring = false } = {}) {
  if (typeof spec !== "string") {
    fail(`matcher must be a string, got ${typeof spec}`);
  }
  if (spec.startsWith("re:")) {
    const rx = new RegExp(spec.slice(3));
    return (value) => typeof value === "string" && rx.test(value);
  }
  if (substring) {
    return (value) => typeof value === "string" && value.includes(spec);
  }
  return (value) => value === spec;
}

function severityAllows(entry, level) {
  if (entry.severity_floor === "ERROR") return level === "ERROR";
  // 'any' -> WARN, ERROR, and INFO all trigger the gate
  return level === "ERROR" || level === "WARN" || level === "INFO";
}

function matchLint(lint, entry) {
  const { matchers } = entry;
  if (!matchers.lint_name(lint.name)) return false;
  const meta = lint.metadata || {};
  if (matchers.schema && !matchers.schema(meta.schema)) return false;
  if (matchers.name && !matchers.name(meta.name)) return false;
  if (matchers.description && !matchers.description(lint.description || "")) {
    return false;
  }
  return severityAllows(entry, lint.level);
}

function main() {
  const payload = loadInput();
  const baseline = loadBaseline();
  const lints = Array.isArray(payload.lints) ? payload.lints : [];

  if (lints.length === 0) {
    console.log("Security regression check: advisors returned 0 lints — nothing to gate.");
    process.exit(0);
  }

  const regressions = [];
  for (const lint of lints) {
    for (const entry of baseline) {
      if (matchLint(lint, entry)) {
        regressions.push({ entry, lint });
      }
    }
  }

  if (regressions.length === 0) {
    console.log(
      `Security regression check: ${lints.length} advisor lint(s) scanned, 0 matches against ${baseline.length} baseline entries.`,
    );
    process.exit(0);
  }

  console.error(`❌ Security regression check: ${regressions.length} baseline match(es) detected.`);
  for (const { entry, lint } of regressions) {
    const meta = lint.metadata || {};
    const target = [meta.schema, meta.name].filter(Boolean).join(".") || "(no metadata)";
    const line = `${entry.id} :: lint=${lint.name} level=${lint.level} target=${target}`;
    console.error(`::error title=Security regression (${entry.id})::${line} — ${entry.reference}`);
    console.error(`   description: ${lint.description || "(none)"}`);
  }
  console.error(
    "\nA previously-fixed finding (or a class rule that must never regress) reappeared. " +
      "Do NOT silence by editing the baseline — fix the underlying schema/policy first. " +
      "If a baseline entry is genuinely obsolete, remove it in a dedicated commit with a security review.",
  );
  process.exit(1);
}

main();
