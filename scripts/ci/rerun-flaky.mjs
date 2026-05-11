#!/usr/bin/env node
// Deterministic rerun helper for quarantined-flaky tests.
//
// Usage:
//   node scripts/ci/rerun-flaky.mjs --suite=vitest    --junit=test-reports/vitest/junit.xml
//   node scripts/ci/rerun-flaky.mjs --suite=playwright --junit=test-reports/playwright/junit.xml
//
// Behaviour:
//   1. Parse the junit XML produced by the initial run.
//   2. For every failed test ID, check it against the quarantine manifest.
//   3. If ANY failure is NOT quarantined → exit 2 (real regression). The
//      initial run already failed the job, but we re-print the offenders so
//      the GitHub step summary surfaces them clearly.
//   4. Otherwise rerun ONLY the quarantined failures with deterministic env
//      and single-worker settings. Exit 0 if they all pass on rerun (and
//      annotate the summary as recovered), exit 3 if any still fail.
//
// Exit codes are distinct so the workflow can branch on them if desired,
// but the default contract is: 0 = green, anything else = red.

import { spawnSync } from "node:child_process";
import { mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseJunit } from "./parse-junit.mjs";
import { loadManifest, compileMatchers } from "./check-quarantine.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const SUITE = args.suite;
const JUNIT = args.junit;
if (!SUITE || !JUNIT) {
  console.error("usage: rerun-flaky.mjs --suite=<vitest|playwright> --junit=<path>");
  process.exit(64);
}

const summary = process.env.GITHUB_STEP_SUMMARY;
const writeSummary = (s) => {
  process.stdout.write(s);
  if (summary) appendFileSync(summary, s);
};

const failures = parseJunit(JUNIT);
if (failures.length === 0) {
  writeSummary(`## Rerun (${SUITE}): nothing to do — initial run had no failures.\n`);
  process.exit(0);
}

const manifest = loadManifest();
const matchers = compileMatchers(manifest, SUITE);

const quarantined = [];
const real = [];
for (const f of failures) {
  const hit = matchers.find((m) => m.re.test(f.id));
  if (hit) quarantined.push({ ...f, entry: hit.entry });
  else real.push(f);
}

if (real.length > 0) {
  writeSummary(
    [
      `## ❌ Real regression in ${SUITE}`,
      ``,
      `${real.length} test(s) failed AND are not in the quarantine manifest:`,
      ``,
      ...real.map((r) => `- \`${r.id}\``),
      ``,
      `Quarantined failures in the same run: ${quarantined.length}.`,
      `Add a real fix or, if truly intermittent, propose a quarantine entry`,
      `(with issue link + expiry within 30 days) in \`.github/flaky-tests.json\`.`,
      ``,
    ].join("\n"),
  );
  process.exit(2);
}

writeSummary(
  [
    `## 🔁 Rerunning ${quarantined.length} quarantined ${SUITE} test(s)`,
    ``,
    ...quarantined.map((q) => `- \`${q.id}\` — ${q.entry.reason} (${q.entry.issue})`),
    ``,
  ].join("\n"),
);

// Build the rerun command. Both suites get a deterministic env block.
const env = {
  ...process.env,
  TZ: "UTC",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  CI: "true",
  FORCE_COLOR: "0",
};

let cmd, cmdArgs, rerunJunit;
if (SUITE === "vitest") {
  // Match each failed test name. Vitest's --testNamePattern is a regex; we
  // OR the escaped names so the rerun touches only the quarantined cases.
  const pattern = quarantined
    .map((q) => escapeRegex(q.name))
    .join("|");
  rerunJunit = JUNIT.replace(/\.xml$/, "-rerun.xml");
  mkdirSync(dirname(rerunJunit), { recursive: true });
  cmd = "bunx";
  cmdArgs = [
    "vitest", "run",
    `--testNamePattern=${pattern}`,
    "--sequence.shuffle=false",
    "--sequence.concurrent=false",
    "--pool=forks",
    "--poolOptions.forks.singleFork=true",
    "--reporter=dot",
    "--reporter=junit",
    `--outputFile.junit=${rerunJunit}`,
  ];
  env.VITEST_SEED = "0";
} else if (SUITE === "playwright") {
  // Playwright --grep is a regex too. Use the test title (last segment) so
  // describe-block reformatting doesn't break the match.
  const pattern = quarantined
    .map((q) => escapeRegex(q.name))
    .join("|");
  rerunJunit = JUNIT.replace(/\.xml$/, "-rerun.xml");
  mkdirSync(dirname(rerunJunit), { recursive: true });
  cmd = "bunx";
  cmdArgs = [
    "playwright", "test",
    `--grep=${pattern}`,
    "--workers=1",
    "--retries=0",
    "--repeat-each=1",
    "--max-failures=10",
    `--reporter=junit,list`,
  ];
  env.PLAYWRIGHT_JUNIT_OUTPUT_NAME = rerunJunit;
  env.PW_TEST_HTML_REPORT_OPEN = "never";
} else {
  console.error(`unknown suite: ${SUITE}`);
  process.exit(64);
}

writeSummary(`\n\`\`\`\n$ ${cmd} ${cmdArgs.join(" ")}\n\`\`\`\n\n`);

const result = spawnSync(cmd, cmdArgs, { env, stdio: "inherit" });
const rerunFailures = parseJunit(rerunJunit);

if (result.status === 0 && rerunFailures.length === 0) {
  writeSummary(
    [
      `## ✅ Quarantined ${SUITE} tests recovered on deterministic rerun`,
      ``,
      `${quarantined.length} test(s) passed on the second attempt. Job continues green.`,
      ``,
      `::warning::Flaky ${SUITE} tests recovered on rerun: ${quarantined.length}`,
      ``,
    ].join("\n"),
  );
  process.exit(0);
}

writeSummary(
  [
    `## ❌ Quarantined ${SUITE} tests STILL failing on deterministic rerun`,
    ``,
    ...rerunFailures.map((r) => `- \`${r.id}\``),
    ``,
    `These were already on the quarantine list but failed twice in a row`,
    `under deterministic settings. Treat as a real regression — either fix`,
    `the test, escalate the underlying bug, or remove the entry.`,
    ``,
  ].join("\n"),
);
process.exit(3);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
