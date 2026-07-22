#!/usr/bin/env node
// Dedicated rerun/timeout strategy for security concurrency-class tests.
//
// Contract (documented in docs/ci-security-concurrency-strategy.md):
//
//   1. Run ONLY the files listed in .github/security-concurrency-tests.json,
//      with an elevated per-test timeout and single-fork isolation.
//   2. If the initial pass fails, retry only the failing test IDs, up to
//      `maxAttempts` total attempts, backing off per `backoffMs`.
//   3. Every attempt (pass or fail) is recorded to the flake-frequency
//      tracker. Quarantine decisions are then made against the historical
//      record, NOT against a single job run — a first-time cold-start flake
//      does not earn a quarantine entry.
//   4. Exit codes:
//        0 → all tests eventually passed
//        3 → at least one test failed every attempt (real regression OR
//            severe flake — check the tracker's recommendation)
//
// This script is intentionally separate from `rerun-flaky.mjs`: that one
// only reruns tests already on the quarantine allowlist, while THIS one
// runs the concurrency class every time and gathers the evidence needed
// to decide whether they belong on that allowlist in the first place.

import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { parseJunit } from "./parse-junit.mjs";

const CONFIG_PATH = process.env.SEC_CONCURRENCY_CONFIG || ".github/security-concurrency-tests.json";
const HISTORY_PATH =
  process.env.SEC_CONCURRENCY_HISTORY || ".github/security-concurrency-flake-history.jsonl";
const TRACKER = "scripts/ci/security-concurrency-flake-tracker.mjs";

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function writeSummary(s) {
  process.stdout.write(s);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, s);
  }
}

function runVitest({ files, testNamePattern, junitOut, perTestTimeoutMs, singleFork }) {
  mkdirSync(dirname(junitOut), { recursive: true });
  const args = [
    "vitest",
    "run",
    ...files,
    `--testTimeout=${perTestTimeoutMs}`,
    "--sequence.shuffle=false",
    "--sequence.concurrent=false",
    "--pool=forks",
    ...(singleFork ? ["--poolOptions.forks.singleFork=true"] : []),
    "--reporter=dot",
    "--reporter=junit",
    `--outputFile.junit=${junitOut}`,
  ];
  if (testNamePattern) args.push(`--testNamePattern=${testNamePattern}`);
  const env = {
    ...process.env,
    TZ: "UTC",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    CI: "true",
    FORCE_COLOR: "0",
    VITEST_SEED: "0",
  };
  return spawnSync("bunx", args, { env, stdio: "inherit" });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recordAttempt({ testId, outcome, attempt }) {
  spawnSync(
    "node",
    [
      TRACKER,
      "record",
      `--path=${HISTORY_PATH}`,
      `--test-id=${testId}`,
      `--outcome=${outcome}`,
      `--attempt=${attempt}`,
      "--suite=security-concurrency",
    ],
    { stdio: "inherit" },
  );
}

function decisionFor(testId) {
  const res = spawnSync(
    "node",
    [TRACKER, "decide", `--path=${HISTORY_PATH}`, `--config=${CONFIG_PATH}`, `--test-id=${testId}`],
    { encoding: "utf8" },
  );
  return (res.stdout || "").trim() || "STABLE";
}

async function main() {
  const cfg = loadConfig();
  const { perTestTimeoutMs, maxAttempts, backoffMs, singleFork } = cfg.strategy;

  writeSummary(
    [
      `## 🧪 Security concurrency suite`,
      ``,
      `Files: ${cfg.files.length} · perTestTimeout: ${perTestTimeoutMs}ms · maxAttempts: ${maxAttempts}`,
      ``,
    ].join("\n"),
  );

  const missing = cfg.files.filter((f) => !existsSync(f));
  if (missing.length > 0) {
    writeSummary(`::warning::Skipping missing concurrency-suite files:\n${missing.map((m) => `- ${m}`).join("\n")}\n\n`);
  }
  const files = cfg.files.filter((f) => existsSync(f));
  if (files.length === 0) {
    writeSummary(`No concurrency-suite files present; nothing to run.\n`);
    process.exit(0);
  }

  // Attempt 1: full suite.
  let attempt = 1;
  const junit1 = `test-reports/security-concurrency/attempt-${attempt}.xml`;
  const first = runVitest({
    files,
    junitOut: junit1,
    perTestTimeoutMs,
    singleFork,
  });
  let failures = parseJunit(junit1);
  const passedTestIds = new Set(); // best-effort: parseJunit only reports failures

  // Record every failure from attempt 1. We deliberately do not attempt to
  // enumerate passes from the JUnit here — the tracker's failure signal is
  // what drives the quarantine recommendation.
  for (const f of failures) recordAttempt({ testId: f.id, outcome: "fail", attempt });

  if (first.status === 0 && failures.length === 0) {
    writeSummary(`## ✅ Security concurrency suite green on first attempt.\n`);
    process.exit(0);
  }

  writeSummary(
    [
      `### Attempt 1 failed — ${failures.length} test(s):`,
      ``,
      ...failures.map((f) => `- \`${f.id}\``),
      ``,
    ].join("\n"),
  );

  // Retries.
  let stillFailing = failures;
  while (attempt < maxAttempts && stillFailing.length > 0) {
    attempt += 1;
    const wait = backoffMs?.[attempt - 1] ?? 15000;
    if (wait > 0) {
      writeSummary(`_Waiting ${wait}ms before attempt ${attempt}…_\n\n`);
      await sleep(wait);
    }
    const pattern = stillFailing.map((f) => escapeRegex(f.name)).join("|");
    const junitN = `test-reports/security-concurrency/attempt-${attempt}.xml`;
    runVitest({
      files,
      testNamePattern: pattern,
      junitOut: junitN,
      perTestTimeoutMs,
      singleFork,
    });
    const nextFailures = parseJunit(junitN);
    const nextFailIds = new Set(nextFailures.map((f) => f.id));

    // Anything that failed last round but is not in nextFailIds passed.
    for (const prev of stillFailing) {
      if (!nextFailIds.has(prev.id)) {
        recordAttempt({ testId: prev.id, outcome: "pass", attempt });
        passedTestIds.add(prev.id);
      }
    }
    for (const f of nextFailures) recordAttempt({ testId: f.id, outcome: "fail", attempt });

    writeSummary(
      [
        `### Attempt ${attempt}`,
        ``,
        `- Recovered: ${stillFailing.length - nextFailures.length}`,
        `- Still failing: ${nextFailures.length}`,
        ``,
      ].join("\n"),
    );
    stillFailing = nextFailures;
  }

  // Emit per-test recommendation using the persisted tracker history.
  const lines = [
    `## 📊 Flake-frequency verdict (from historical tracker)`,
    ``,
    `| Test | Latest run | Recommendation |`,
    `| --- | --- | --- |`,
  ];
  const seen = new Set();
  for (const f of failures) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const stillFailingNow = stillFailing.some((s) => s.id === f.id);
    const rec = decisionFor(f.id);
    lines.push(
      `| \`${f.id}\` | ${stillFailingNow ? "❌ failed all attempts" : "✅ recovered on retry"} | **${rec}** |`,
    );
  }
  lines.push("");
  writeSummary(lines.join("\n"));

  if (stillFailing.length === 0) {
    writeSummary(
      [
        `## ✅ Security concurrency suite recovered on retry`,
        ``,
        `All failing tests passed within ${maxAttempts} attempts. Job stays green.`,
        `Frequency has been recorded; consult the report artifact before opening`,
        `a quarantine PR — first-time cold-start flakes should NOT be quarantined.`,
        ``,
        `::warning::Security concurrency tests recovered on rerun: ${failures.length}`,
        ``,
      ].join("\n"),
    );
    process.exit(0);
  }

  writeSummary(
    [
      `## ❌ Security concurrency tests still failing after ${maxAttempts} attempts`,
      ``,
      ...stillFailing.map((f) => `- \`${f.id}\``),
      ``,
      `Failure was reproducible under deterministic settings with an elevated`,
      `per-test timeout of ${perTestTimeoutMs}ms. Treat as a real regression`,
      `unless the tracker recommends \`RECOMMEND_QUARANTINE\` for the specific`,
      `test — in which case add a time-boxed entry to \`.github/flaky-tests.json\`.`,
      ``,
    ].join("\n"),
  );
  process.exit(3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
