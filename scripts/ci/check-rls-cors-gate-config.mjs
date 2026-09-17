#!/usr/bin/env node
/**
 * Static configuration gate for the RLS / CORS security gate.
 *
 * The runtime preflight (rls-cors-gate-preflight.mjs) answers "can this run
 * reach the test tenants?". It cannot answer "is the gate still wired to the
 * things it is supposed to protect?" — a renamed test file, a dropped secret
 * from an env block, a removed preflight step or a gate-summary that no longer
 * depends on a job all leave a green check that asserts less than it claims.
 *
 * This check runs first, in milliseconds, with no network and no secrets, and
 * fails with one actionable error per problem:
 *
 *   exit 0   the gate workflow is wired correctly
 *   exit 1   at least one required setting is missing or misconfigured
 *
 * Usage:
 *   node scripts/ci/check-rls-cors-gate-config.mjs
 *   node scripts/ci/check-rls-cors-gate-config.mjs --workflow path/to.yml --root .
 */

import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const ROOT = resolve(argValue("--root", process.cwd()));
const WORKFLOW = resolve(ROOT, argValue("--workflow", ".github/workflows/rls-cors-gate.yml"));
const PREFLIGHT_SCRIPT = "scripts/ci/rls-cors-gate-preflight.mjs";
const LIVE_CONFIG = "vitest.security-live.config.ts";

/** Jobs the gate must keep. Removing one silently narrows the gate. */
const REQUIRED_JOBS = [
  "rls-cors-tests",
  "rls-advisor-gate",
  "gate-summary",
  "notify-tenant-denial",
];


/** Secrets the preflight and the live suites need to run against a project. */
const REQUIRED_TEST_SECRETS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RLS_TEST_TENANT_A_EMAIL",
  "RLS_TEST_TENANT_A_PASSWORD",
  "RLS_TEST_TENANT_A_ID",
  "RLS_TEST_TENANT_B_EMAIL",
  "RLS_TEST_TENANT_B_PASSWORD",
  "RLS_TEST_TENANT_B_ID",
];

/** Secrets the advisor job needs. */
const REQUIRED_ADVISOR_SECRETS = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF"];

/**
 * Test files the gate must keep running. These are the RLS and CORS slices the
 * gate exists for; if one is renamed or dropped, the gate must fail loudly
 * instead of quietly protecting less.
 */
const REQUIRED_TESTS = [
  "src/test/security/cross-tenant-rls.test.ts",
  "src/test/security/cross-tenant-log-isolation.test.ts",
  "src/test/security/cross-tenant-storage.test.ts",
  "src/test/security/tenant-table-manifest.test.ts",
  "src/test/security/edge-function-cors-custom-headers.test.ts",
  "src/test/security/cors-validation.test.ts",
  "src/test/security/edge-function-csp.test.ts",
  "src/test/security/public-booking-response-headers.test.ts",
];

const problems = [];
const notes = [];

const fail = (title, message) => problems.push({ title, message });
const note = (line) => notes.push(line);

if (!existsSync(WORKFLOW)) {
  fail(
    "RLS/CORS gate workflow missing",
    `${WORKFLOW} does not exist. The RLS/CORS gate cannot run, so nothing blocks a cross-tenant or CORS regression.`,
  );
  report();
}

const yml = readFileSync(WORKFLOW, "utf8");

// ---------------------------------------------------------------- triggers
if (!/^on:/m.test(yml)) {
  fail("Gate has no triggers", "The workflow has no `on:` block, so it never runs.");
} else {
  if (!/\bpush:\s*\n\s*branches:\s*\[[^\]]*main/.test(yml)) {
    fail(
      "Gate does not run on main pushes",
      "Add `push: branches: [main]` to `on:` so a regression merged to main is caught.",
    );
  }
  if (!/\bpull_request:\s*\n\s*branches:\s*\[[^\]]*main/.test(yml)) {
    fail(
      "Gate does not run on pull requests",
      "Add `pull_request: branches: [main]` to `on:` — without it the gate cannot block a merge.",
    );
  }
}

if (!/^concurrency:/m.test(yml)) {
  fail(
    "Gate has no concurrency group",
    "Add a `concurrency:` block so superseded runs are cancelled and the live project is not dialled by several runs at once.",
  );
}

if (!/^permissions:\s*\n\s*contents:\s*read/m.test(yml)) {
  fail(
    "Gate token is not read-only",
    "Add `permissions: contents: read` to the workflow so the gate runs with the least privilege it needs.",
  );
}

// -------------------------------------------------------------------- jobs
for (const job of REQUIRED_JOBS) {
  if (!new RegExp(`^\\s{2}${job}:`, "m").test(yml)) {
    fail(
      `Gate job "${job}" missing`,
      `The workflow no longer defines the "${job}" job, so that part of the gate does not run. Restore it or update this check deliberately.`,
    );
  }
}

// -------------------------------------------------------------- preflight
if (!yml.includes(PREFLIGHT_SCRIPT)) {
  fail(
    "Preflight step missing",
    `The workflow does not run ${PREFLIGHT_SCRIPT}. Without it a run with broken credentials skips every live suite and still reports success.`,
  );
} else if (!existsSync(join(ROOT, PREFLIGHT_SCRIPT))) {
  fail(
    "Preflight script missing from the repository",
    `The workflow runs ${PREFLIGHT_SCRIPT} but that file does not exist, so the gate job fails with a confusing "not found" error.`,
  );
}

if (!/steps\.preflight\.outputs\.mode\s*==\s*'live'/.test(yml)) {
  fail(
    "All-skipped runs are not treated as failures",
    "The step guarded by `steps.preflight.outputs.mode == 'live'` is gone. Restore it, otherwise a live-capable run where every RLS test skips counts as a pass.",
  );
}

// ---------------------------------------------------------------- secrets
const referencedSecrets = new Set(
  [...yml.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]),
);
for (const secret of REQUIRED_TEST_SECRETS) {
  if (!referencedSecrets.has(secret)) {
    fail(
      `Gate input ${secret} not wired`,
      `The workflow never passes secrets.${secret}, so the live RLS suites cannot authenticate and would skip. Add it to the preflight/test env block.`,
    );
  }
}
for (const secret of REQUIRED_ADVISOR_SECRETS) {
  if (!referencedSecrets.has(secret)) {
    fail(
      `Advisor input ${secret} not wired`,
      `The Supabase RLS advisor job needs secrets.${secret}; without it the advisor gate skips itself and policy findings do not block a merge.`,
    );
  }
}

// ------------------------------------------------------------- test wiring
if (!yml.includes(LIVE_CONFIG)) {
  fail(
    "Live Vitest config not used",
    `The gate must run the live suites with --config ${LIVE_CONFIG}; the default config excludes them, so they would not execute at all.`,
  );
} else if (!existsSync(join(ROOT, LIVE_CONFIG))) {
  fail(
    "Live Vitest config missing from the repository",
    `${LIVE_CONFIG} is referenced by the workflow but does not exist.`,
  );
}

for (const test of REQUIRED_TESTS) {
  if (!yml.includes(test)) {
    fail(
      `Gate no longer runs ${test}`,
      `This RLS/CORS test is required by the gate but is not referenced in the workflow. Add it back, or move the requirement in ${"scripts/ci/check-rls-cors-gate-config.mjs"} in the same change.`,
    );
  }
}

// Every test file the workflow names must exist, so a rename cannot leave a
// step that runs zero files (Vitest treats that as success in some setups).
const referencedTests = [...yml.matchAll(/src\/test\/security\/[\w.-]+\.test\.ts/g)].map(
  (m) => m[0],
);
for (const test of new Set(referencedTests)) {
  if (!existsSync(join(ROOT, test))) {
    fail(
      `Gate references a missing test file`,
      `${test} is listed in the workflow but does not exist in the repository, so that step asserts nothing.`,
    );
  }
}
note(`Referenced security test files: ${new Set(referencedTests).size}`);

// Live network steps must cap stalled sockets, otherwise one hung request
// burns the whole job timeout and the gate reports a timeout, not a cause.
const liveSteps = [...yml.matchAll(/bunx vitest run --config vitest\.security-live\.config\.ts/g)];
const timeoutCount = [...yml.matchAll(/LIVE_FETCH_TIMEOUT_MS/g)].length;
if (liveSteps.length > 0 && timeoutCount < liveSteps.length) {
  fail(
    "Live steps missing LIVE_FETCH_TIMEOUT_MS",
    `${liveSteps.length} live Vitest step(s) but only ${timeoutCount} LIVE_FETCH_TIMEOUT_MS setting(s). Set it on every live step so a stalled socket fails fast with a clear reason.`,
  );
}
note(`Live Vitest steps: ${liveSteps.length}`);

// ------------------------------------------------------------ run logs
// The gate's steps tee their output into test-reports/logs and upload it as an
// artifact. If that wiring is dropped, a failure can only be read in the
// browser log viewer, which truncates long live suites.
const LOGS_DIR = "test-reports/logs";
const LOGS_ARTIFACT = "rls-cors-gate-logs";

if (!yml.includes("actions/upload-artifact@")) {
  fail(
    "Gate uploads no run logs",
    `Add an actions/upload-artifact step that uploads ${LOGS_DIR}, otherwise a failing run can only be read in the truncating log viewer.`,
  );
} else {
  if (!new RegExp(`name:\\s*${LOGS_ARTIFACT}\\b`).test(yml)) {
    fail(
      "Run log artifact renamed or removed",
      `No upload step is named "${LOGS_ARTIFACT}". Keep that name so the logs are findable on the run page, or update this check deliberately.`,
    );
  }
  if (!yml.includes(LOGS_DIR)) {
    fail(
      "Run logs are not collected",
      `No step writes to ${LOGS_DIR}. Each gate step must tee its output there so the artifact contains the full text of the run.`,
    );
  }
  // An upload that only runs on success is useless: failures are the reason
  // the artifact exists.
  // Split into step blocks by line, so a long workflow cannot make a nested
  // regex backtrack.
  const stepBlocks = [];
  for (const line of yml.split("\n")) {
    if (/^\s*- (name|uses):/.test(line)) stepBlocks.push([]);
    if (stepBlocks.length > 0) stepBlocks[stepBlocks.length - 1].push(line);
  }
  const uploadBlocks = stepBlocks
    .map((b) => b.join("\n"))
    .filter((b) => b.includes("actions/upload-artifact@"));
  for (const block of uploadBlocks) {
    if (!/if:\s*always\(\)/.test(block)) {
      fail(
        "Log upload is skipped on failure",
        "Every actions/upload-artifact step in this gate needs `if: always()`, otherwise the logs are missing exactly when a step failed.",
      );
      break;
    }
  }
  if (!yml.includes("00-index.txt")) {
    fail(
      "Log artifact has no index",
      "The gate must write test-reports/logs/00-index.txt (run URL, commit, preflight mode, failing lines) so the artifact can be triaged without opening every log.",
    );
  }
}

// Every step that runs tests or the preflight must persist its output.
const logWrites = new Set(
  [...yml.matchAll(/test-reports\/logs\/([\w.-]+)/g)].map((m) => m[1]).filter((f) => f.endsWith(".log")),
);
const testStepCount = [...yml.matchAll(/bunx vitest run/g)].length + 1; // + preflight
if (logWrites.size < testStepCount) {
  fail(
    "Some gate steps do not persist their output",
    `${testStepCount} gate step(s) run tests or the preflight but only ${logWrites.size} log file(s) are written under ${LOGS_DIR}. Tee every step's output into its own log file.`,
  );
}
note(`Run log files collected: ${logWrites.size}`);

// -------------------------------------------------- denial notification
// A tenant-access denial is the gate's most serious outcome. It must reach the
// maintainer outside the run page, so the notification job has to stay wired to
// the preflight's mode output and keep permission to file the issue.
const notifyStart = yml.indexOf("  notify-tenant-denial:");
if (notifyStart !== -1) {
  const summaryStart = yml.indexOf("  gate-summary:");
  const notifyBlock = yml.slice(
    notifyStart,
    summaryStart > notifyStart ? summaryStart : undefined,
  );
  if (!/needs:[^\n]*rls-cors-tests/.test(notifyBlock)) {
    fail(
      "Denial notification does not depend on the test job",
      "Add `needs: [rls-cors-tests]` to notify-tenant-denial, otherwise it cannot read the preflight result and never reports a blocked tenant.",
    );
  }
  if (!/if:\s*always\(\)[^\n]*tenant_access\s*==\s*'denied'/.test(notifyBlock)) {
    fail(
      "Denial notification never triggers",
      "notify-tenant-denial must use `if: always() && needs.rls-cors-tests.outputs.tenant_access == 'denied'`; without it the job is skipped when the gate job fails, which is exactly when a denial happens.",
    );
  }
  if (!/issues:\s*write/.test(notifyBlock)) {
    fail(
      "Denial notification cannot file an issue",
      "Add `permissions: issues: write` to notify-tenant-denial, otherwise the GitHub API rejects the notification with 403 and the denial stays silent.",
    );
  }
  if (!/actions\/github-script@/.test(notifyBlock)) {
    fail(
      "Denial notification has no reporting step",
      "notify-tenant-denial must use actions/github-script to open or comment on the tenant-access denial issue.",
    );
  }
  if (!/tenant_access:\s*\$\{\{\s*steps\.preflight\.outputs\.mode/.test(yml)) {
    fail(
      "Preflight result is not exposed to the notification",
      "The rls-cors-tests job must expose `outputs: tenant_access: ${{ steps.preflight.outputs.mode }}` so a denial can be notified.",
    );
  }
  for (const output of ["denied_title", "denied_reason"]) {
    if (!new RegExp(`steps\\.preflight\\.outputs\\.${output}`).test(yml)) {
      fail(
        `Denial notification is missing ${output}`,
        `The rls-cors-tests job must expose steps.preflight.outputs.${output} so the notification states why tenant access was denied.`,
      );
    }
  }
}

// ------------------------------------------------------------ gate summary
const summaryBlock = yml.slice(yml.indexOf("  gate-summary:"));
if (summaryBlock) {
  for (const job of ["rls-cors-tests", "rls-advisor-gate"]) {
    if (!new RegExp(`needs:[^\\n]*${job}`).test(summaryBlock)) {
      fail(
        `gate-summary does not depend on "${job}"`,
        `Add "${job}" to the gate-summary \`needs:\` list, otherwise its failure never reaches the required check.`,
      );
    }
  }
  if (!/if:\s*always\(\)/.test(summaryBlock)) {
    fail(
      "gate-summary is skipped when a job fails",
      "Add `if: always()` to gate-summary so it still reports (and fails) after an upstream job fails.",
    );
  }
  if (!/exit 1/.test(summaryBlock)) {
    fail(
      "gate-summary never fails the build",
      "The gate-summary step must `exit 1` when an upstream job did not succeed, otherwise the required check stays green.",
    );
  }
}


report();

function report() {
  const summary = [];
  for (const line of notes) {
    console.log(`  ${line}`);
    summary.push(`- ${line}`);
  }

  if (problems.length === 0) {
    console.log("✅ RLS/CORS gate configuration is complete.");
    writeSummary(["### RLS/CORS gate configuration", "", "✅ complete.", "", ...summary]);
    process.exit(0);
  }

  console.error(
    `\n❌ ${problems.length} RLS/CORS gate configuration problem(s). The gate would not protect what it claims:\n`,
  );
  for (const p of problems) {
    console.log(`::error title=${p.title}::${p.message}`);
    console.error(`  • ${p.title}: ${p.message}`);
  }
  writeSummary([
    "### RLS/CORS gate configuration",
    "",
    `❌ ${problems.length} problem(s):`,
    "",
    ...problems.map((p) => `- **${p.title}** — ${p.message}`),
    "",
    ...summary,
  ]);
  process.exit(1);
}

function writeSummary(lines) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n\n`);
  } catch {
    // A summary write failure must never mask the check's own result.
  }
}
