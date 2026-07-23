#!/usr/bin/env node
// Flake-frequency tracker for the security concurrency test class.
//
// Persists a JSONL history of every attempt (pass or fail) recorded by the
// dedicated rerun script, and computes per-test frequency stats over a
// configurable window. The tracker is the authoritative input for the
// "should we quarantine this test?" decision — we no longer quarantine on
// the first CI red, we quarantine only after the recorded failure rate
// crosses the threshold in .github/security-concurrency-tests.json.
//
// Storage model: append-only JSONL at `path` (default
// `.github/security-concurrency-flake-history.jsonl`). Records are
// { ts, testId, suite, attempt, outcome, runId, sha }. Rotation is by
// age (records older than 2× windowDays are dropped on `prune`).
//
// Subcommands:
//   record  --path=<file> --test-id=<id> --outcome=<pass|fail>
//           [--attempt=<n>] [--suite=<name>] [--run-id=<id>] [--sha=<sha>]
//   report  --path=<file> --config=<file> [--test-id=<id>] [--json]
//   prune   --path=<file> --config=<file>
//   decide  --path=<file> --config=<file> --test-id=<id>
//             → prints one of: STABLE | OBSERVE | RECOMMEND_QUARANTINE
//             → exit code 0 always; consumers key off stdout.

import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";

const DEFAULT_HISTORY = ".github/security-concurrency-flake-history.jsonl";
const DEFAULT_CONFIG = ".github/security-concurrency-tests.json";

// Path traversal / file-inclusion guard. This CLI takes --path and --config
// from argv, which a malicious caller could point at arbitrary files
// (e.g. /etc/passwd, ~/.ssh/id_rsa) before readFileSync ingests them.
// Restrict every filesystem read/write to files under the repo root, and
// only allow the known extensions this tracker uses.
const REPO_ROOT = resolve(process.cwd());
const ALLOWED_EXTS = [".json", ".jsonl"];

function safeResolve(inputPath, { label }) {
  if (typeof inputPath !== "string" || inputPath.length === 0) {
    throw new Error(`${label}: path must be a non-empty string`);
  }
  if (inputPath.includes("\0")) {
    throw new Error(`${label}: path must not contain NUL bytes`);
  }
  const abs = isAbsolute(inputPath) ? resolve(inputPath) : resolve(REPO_ROOT, inputPath);
  const rel = relative(REPO_ROOT, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`${label}: path must stay inside the repo root (${REPO_ROOT})`);
  }
  if (!ALLOWED_EXTS.some((ext) => abs.toLowerCase().endsWith(ext))) {
    throw new Error(`${label}: path must end with one of ${ALLOWED_EXTS.join(", ")}`);
  }
  return abs;
}

function parseArgs(argv) {
  const [sub, ...rest] = argv;
  const args = Object.fromEntries(
    rest.map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    }),
  );
  return { sub, args };
}

function loadConfig(path = DEFAULT_CONFIG) {
  const safe = safeResolve(path, { label: "config" });
  const raw = readFileSync(safe, "utf8");
  return JSON.parse(raw);
}

function loadHistory(path) {
  const safe = safeResolve(path, { label: "history" });
  if (!existsSync(safe)) return [];
  const raw = readFileSync(safe, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        console.error(`[flake-tracker] skipping malformed line ${i + 1}: ${err.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

function ensureDir(path) {
  const safe = safeResolve(path, { label: "history" });
  mkdirSync(dirname(safe), { recursive: true });
  return safe;
}

function record({ path, testId, outcome, attempt, suite, runId, sha }) {
  if (!testId) throw new Error("record: --test-id required");
  if (outcome !== "pass" && outcome !== "fail") {
    throw new Error(`record: --outcome must be pass|fail, got ${outcome}`);
  }
  const safe = ensureDir(path);
  const rec = {
    ts: new Date().toISOString(),
    testId,
    suite: suite || "security-concurrency",
    attempt: Number(attempt || 1),
    outcome,
    runId: runId || process.env.GITHUB_RUN_ID || null,
    sha: sha || process.env.GITHUB_SHA || null,
  };
  appendFileSync(safe, JSON.stringify(rec) + "\n");
  return rec;
}

function statsFor(history, testId, windowDays) {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const window = history.filter(
    (r) => r.testId === testId && Date.parse(r.ts) >= cutoff,
  );
  const attempts = window.length;
  const failures = window.filter((r) => r.outcome === "fail").length;
  // A "failed run" = a run where the FINAL attempt failed. This is the
  // metric that actually maps to "user saw a red build".
  const byRun = new Map();
  for (const r of window) {
    const key = r.runId || `${r.ts}`;
    const prev = byRun.get(key);
    if (!prev || r.attempt > prev.attempt) byRun.set(key, r);
  }
  const failedRuns = [...byRun.values()].filter((r) => r.outcome === "fail").length;
  const totalRuns = byRun.size;
  return {
    testId,
    windowDays,
    attempts,
    failures,
    totalRuns,
    failedRuns,
    failureRate: totalRuns === 0 ? 0 : failedRuns / totalRuns,
    firstSeen: window[0]?.ts ?? null,
    lastSeen: window[window.length - 1]?.ts ?? null,
  };
}

function decide(stats, thresholds) {
  const {
    observeAfterFailures,
    recommendQuarantineAfterFailures,
    recommendQuarantineMinFailureRate,
  } = thresholds;
  if (
    stats.failedRuns >= recommendQuarantineAfterFailures &&
    stats.failureRate >= recommendQuarantineMinFailureRate
  ) {
    return "RECOMMEND_QUARANTINE";
  }
  if (stats.failedRuns >= observeAfterFailures) return "OBSERVE";
  return "STABLE";
}

function report({ path, configPath, testId, asJson }) {
  const cfg = loadConfig(configPath);
  const history = loadHistory(path);
  const ids = testId
    ? [testId]
    : [...new Set(history.map((r) => r.testId))].sort();
  const rows = ids.map((id) => {
    const s = statsFor(history, id, cfg.quarantineThresholds.windowDays);
    return { ...s, recommendation: decide(s, cfg.quarantineThresholds) };
  });
  if (asJson) {
    process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + "\n");
    return;
  }
  if (rows.length === 0) {
    console.log("(no flake history recorded yet)");
    return;
  }
  console.log(
    `Flake report — window=${cfg.quarantineThresholds.windowDays}d, ` +
      `observe≥${cfg.quarantineThresholds.observeAfterFailures} fail, ` +
      `recommend≥${cfg.quarantineThresholds.recommendQuarantineAfterFailures} fail AND ` +
      `≥${(cfg.quarantineThresholds.recommendQuarantineMinFailureRate * 100).toFixed(0)}% rate`,
  );
  console.log("");
  console.log("  Recommendation        | Fails/Runs | Rate  | Test");
  console.log("  ----------------------+------------+-------+-----------------------------------------");
  for (const r of rows) {
    console.log(
      `  ${r.recommendation.padEnd(21)} | ${String(r.failedRuns).padStart(4)}/${String(r.totalRuns).padEnd(5)} | ${(r.failureRate * 100).toFixed(0).padStart(4)}% | ${r.testId}`,
    );
  }
}

function prune({ path, configPath }) {
  const cfg = loadConfig(configPath);
  const history = loadHistory(path);
  const cutoff = Date.now() - cfg.quarantineThresholds.windowDays * 2 * 24 * 60 * 60 * 1000;
  const kept = history.filter((r) => Date.parse(r.ts) >= cutoff);
  ensureDir(path);
  writeFileSync(path, kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : ""));
  console.log(`[flake-tracker] pruned ${history.length - kept.length} record(s); kept ${kept.length}.`);
}

const { sub, args } = parseArgs(process.argv.slice(2));
const path = args.path || DEFAULT_HISTORY;
const configPath = args.config || DEFAULT_CONFIG;

try {
  switch (sub) {
    case "record": {
      const rec = record({
        path,
        testId: args["test-id"],
        outcome: args.outcome,
        attempt: args.attempt,
        suite: args.suite,
        runId: args["run-id"],
        sha: args.sha,
      });
      console.log(`[flake-tracker] recorded ${rec.outcome} attempt=${rec.attempt} test=${rec.testId}`);
      break;
    }
    case "report":
      report({ path, configPath, testId: args["test-id"], asJson: args.json === "true" });
      break;
    case "prune":
      prune({ path, configPath });
      break;
    case "decide": {
      if (!args["test-id"]) throw new Error("decide: --test-id required");
      const cfg = loadConfig(configPath);
      const history = loadHistory(path);
      const s = statsFor(history, args["test-id"], cfg.quarantineThresholds.windowDays);
      console.log(decide(s, cfg.quarantineThresholds));
      break;
    }
    default:
      console.error(
        "usage: security-concurrency-flake-tracker.mjs <record|report|prune|decide> [--path=] [--config=] ...",
      );
      process.exit(64);
  }
} catch (err) {
  console.error(`[flake-tracker] ${err.message}`);
  process.exit(1);
}

export { statsFor, decide, loadHistory, loadConfig };
