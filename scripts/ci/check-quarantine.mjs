#!/usr/bin/env node
// Hygiene check for .github/flaky-tests.json.
//
// Exits 0 when the manifest is well-formed AND every entry is unexpired AND
// the total list is under MAX_ENTRIES. Exits non-zero (with a per-rule
// diagnostic) otherwise. Designed to run on every push, so quarantine can
// never silently rot.
//
// Also exported as `loadManifest()` / `validateManifest()` so the rerun
// helper and the Vitest unit tests can reuse the exact same rules.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { safeResolveWithin } from "./safe-path.mjs";

export const MANIFEST_PATH = resolve(
  process.env.QUARANTINE_PATH ?? ".github/flaky-tests.json",
);
export const MAX_ENTRIES = Number(process.env.QUARANTINE_MAX ?? 15);
export const MAX_AGE_DAYS = 30;

const REQUIRED_KEYS = ["pattern", "reason", "owner", "added", "expires", "issue"];
const SECTIONS = ["vitest", "playwright"];

export function loadManifest(path = MANIFEST_PATH) {
  const safe = safeResolveWithin(path);
  if (!existsSync(safe)) {
    return { vitest: [], playwright: [] };
  }
  const raw = readFileSync(safe, "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`flaky-tests.json is not valid JSON: ${e.message}`);
  }
  for (const s of SECTIONS) if (!Array.isArray(json[s])) json[s] = [];
  return json;
}

/**
 * Returns { ok, errors, warnings, total }. Pure — no I/O.
 *
 * @param {object} manifest  loaded JSON
 * @param {object} opts      { now?: Date, maxEntries?: number, maxAgeDays?: number }
 */
export function validateManifest(manifest, opts = {}) {
  const now = opts.now ?? new Date();
  const maxEntries = opts.maxEntries ?? MAX_ENTRIES;
  const maxAge = opts.maxAgeDays ?? MAX_AGE_DAYS;
  const errors = [];
  const warnings = [];
  let total = 0;
  const seenPatterns = new Set();

  for (const section of SECTIONS) {
    const entries = manifest[section] ?? [];
    if (!Array.isArray(entries)) {
      errors.push(`section "${section}" must be an array`);
      continue;
    }
    total += entries.length;

    let prevPattern = "";
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const where = `${section}[${i}]`;
      if (!e || typeof e !== "object") {
        errors.push(`${where} is not an object`);
        continue;
      }
      for (const k of REQUIRED_KEYS) {
        if (!e[k] || typeof e[k] !== "string") {
          errors.push(`${where} missing/invalid required key "${k}"`);
        }
      }
      if (e.pattern) {
        const dupKey = `${section}::${e.pattern}`;
        if (seenPatterns.has(dupKey)) errors.push(`${where} duplicate pattern "${e.pattern}"`);
        seenPatterns.add(dupKey);
        try { new RegExp(e.pattern); }
        catch (re) { errors.push(`${where} pattern is not a valid regex: ${re.message}`); }
        if (prevPattern && e.pattern < prevPattern) {
          warnings.push(`${where} not sorted (came after "${prevPattern}")`);
        }
        prevPattern = e.pattern;
      }
      const added = parseDate(e.added);
      const expires = parseDate(e.expires);
      if (e.added && !added) errors.push(`${where} added "${e.added}" is not YYYY-MM-DD`);
      if (e.expires && !expires) errors.push(`${where} expires "${e.expires}" is not YYYY-MM-DD`);
      if (added && expires) {
        const ageDays = Math.round((expires - added) / 86_400_000);
        if (ageDays <= 0) errors.push(`${where} expires must be after added`);
        if (ageDays > maxAge) {
          errors.push(`${where} expires must be within ${maxAge} days of added (got ${ageDays})`);
        }
      }
      if (expires && expires < now) {
        errors.push(`${where} EXPIRED on ${e.expires} — fix the underlying flake or open a fresh tracking issue`);
      }
      if (e.issue && typeof e.issue === "string" && !/^https?:\/\//.test(e.issue)) {
        errors.push(`${where} issue must be a full URL`);
      }
    }
  }

  if (total > maxEntries) {
    errors.push(`quarantine has ${total} entries, max is ${maxEntries} — fix flakes instead of adding more`);
  }

  return { ok: errors.length === 0, errors, warnings, total };
}

function parseDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Compile manifest entries into a list of anchored RegExp matchers. */
export function compileMatchers(manifest, section) {
  return (manifest[section] ?? []).map((e) => ({
    re: new RegExp(e.pattern),
    entry: e,
  }));
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const manifest = loadManifest();
    const result = validateManifest(manifest);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    const lines = [
      `## Quarantine hygiene`,
      ``,
      `- Total entries: **${result.total}** (max ${MAX_ENTRIES})`,
      `- Errors: **${result.errors.length}**`,
      `- Warnings: **${result.warnings.length}**`,
      ``,
    ];
    if (result.errors.length) {
      lines.push(`### Errors`);
      for (const e of result.errors) lines.push(`- ${e}`);
      lines.push("");
    }
    if (result.warnings.length) {
      lines.push(`### Warnings`);
      for (const w of result.warnings) lines.push(`- ${w}`);
      lines.push("");
    }
    const out = lines.join("\n");
    process.stdout.write(out + "\n");
    if (summary) {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(summary, out + "\n");
    }
    process.exit(result.ok ? 0 : 1);
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
