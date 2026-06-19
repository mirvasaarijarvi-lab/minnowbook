#!/usr/bin/env node
// Drift-heal: runs the manifest preflight; if drift is reported, runs
// `bun install --save-text-lockfile` to regenerate `bun.lock`, diffs the
// before/after, and prints exactly what to commit. Designed for local
// dev and CI repair jobs — NEVER call this from a frozen-lockfile job;
// it intentionally mutates the lockfile.
//
//   bun run lock:heal           # heal + show diff, non-zero on changes
//   bun run lock:heal --check   # report drift only, never write
//
// Exit codes:
//   0  no drift (or --check and no drift)
//   1  drift detected and healed (lockfile updated → commit it)
//   2  drift detected but heal failed (bun install errored)
//   3  preflight itself errored (bad manifest, etc.)
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const LOCK = join(REPO_ROOT, "bun.lock");
const CHECK_ONLY = process.argv.includes("--check");

const { collectDrift, formatReport } = await import("./preflight-manifest-drift.mjs");

function header(s) {
  return `\n=== ${s} ===`;
}

function unifiedDiff(before, after, label) {
  // Tiny line-level diff: lockfiles are mostly insert/delete, and we
  // want to avoid pulling in a diff library. Anything fancier is just
  // noise for the reviewer.
  const a = before.split("\n");
  const b = after.split("\n");
  const aSet = new Map();
  a.forEach((l, i) => aSet.set(`${i}:${l}`, true));
  const removed = a.filter((l) => !b.includes(l));
  const added = b.filter((l) => !a.includes(l));
  const lines = [`--- ${label} (before)`, `+++ ${label} (after)`];
  for (const l of removed) lines.push(`- ${l}`);
  for (const l of added) lines.push(`+ ${l}`);
  return lines.join("\n");
}

function fail(code, msg) {
  process.stderr.write(msg + "\n");
  process.exit(code);
}

// 1) Preflight.
let pre;
try {
  pre = collectDrift({ root: REPO_ROOT });
} catch (e) {
  fail(3, `lock:heal: preflight crashed — ${e instanceof Error ? e.message : String(e)}`);
}
if (pre.fatal) fail(3, `lock:heal: ${pre.fatal}`);

if (pre.ok) {
  process.stdout.write("lock:heal: package.json already in sync with lockfiles ✓\n");
  process.exit(0);
}

process.stdout.write(formatReport(pre) + "\n");

if (CHECK_ONLY) {
  process.stdout.write("\nlock:heal: --check set, not modifying bun.lock.\n");
  process.exit(1);
}

if (!existsSync(LOCK)) {
  fail(3, `lock:heal: bun.lock missing at ${LOCK}; create one with \`bun install\` first.`);
}

// 2) Snapshot bun.lock so we can show a precise diff after regeneration.
const tmp = mkdtempSync(join(tmpdir(), "lock-heal-"));
const snapshot = join(tmp, "bun.lock.before");
copyFileSync(LOCK, snapshot);

process.stdout.write(header("Regenerating bun.lock (bun install --save-text-lockfile --ignore-scripts)") + "\n");
const install = spawnSync(
  "bun",
  ["install", "--save-text-lockfile", "--ignore-scripts", "--no-summary"],
  { cwd: REPO_ROOT, stdio: "inherit", env: { ...process.env, CI: "1", NO_COLOR: "1" } },
);
if (install.status !== 0) {
  rmSync(tmp, { recursive: true, force: true });
  fail(2, `lock:heal: \`bun install\` exited ${install.status}. Lockfile may be partially updated; inspect manually.`);
}

const before = readFileSync(snapshot, "utf8");
const after = readFileSync(LOCK, "utf8");
rmSync(tmp, { recursive: true, force: true });

if (before === after) {
  process.stdout.write(
    "\nlock:heal: preflight flagged drift but `bun install` produced no changes.\n" +
      "This usually means a transitive specifier was already satisfied — re-run preflight\n" +
      "to confirm, and check whether package-lock.json (npm) is the file actually drifting.\n",
  );
  process.exit(1);
}

// 3) Re-run preflight to confirm and produce the final report.
const post = collectDrift({ root: REPO_ROOT });
process.stdout.write(header("Diff of bun.lock") + "\n");
process.stdout.write(unifiedDiff(before, after, "bun.lock") + "\n");

process.stdout.write(header("Post-heal preflight") + "\n");
process.stdout.write(formatReport(post) + "\n");

process.stdout.write(
  "\nlock:heal: bun.lock updated. Commit with:\n" +
    "  git add bun.lock\n" +
    '  git commit -m "chore(deps): resync bun.lock with package.json"\n',
);

// If npm lockfile is still drifting, surface that too — the user almost
// always needs to regenerate it in the same commit.
if (!post.ok) {
  process.stdout.write(
    "\nlock:heal: package-lock.json still drifts. Regenerate it with:\n" +
      "  npm install --package-lock-only --ignore-scripts --audit=false --fund=false\n" +
      "  git add package-lock.json\n",
  );
}

process.exit(1);
