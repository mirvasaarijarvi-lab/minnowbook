// Tests for guest-link-step-guard.mjs: the real workflow passes, and each
// kind of bypass planted in a copy of it is flagged with the step's name.
// Run: node --test scripts/ci/guest-link-step-guard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkWorkflow, parseSteps } from "./guest-link-step-guard.mjs";

const REAL = readFileSync(".github/workflows/guest-link-local-backend.yml", "utf8");

/** Add a step with the given run script to the revoked-link job. */
function withStep(name, run, extra = "") {
  const body = run
    .split("\n")
    .map((l) => `          ${l}`)
    .join("\n");
  const step = `      - name: ${name}\n${extra}        run: |\n${body}\n\n`;
  return REAL.replace("      - name: Check logs hold no credentials", `${step}      - name: Check logs hold no credentials`);
}

test("the real workflow has no bypasses", () => {
  assert.deepEqual(checkWorkflow(REAL), []);
});

test("parser finds every step with its name and script", () => {
  const steps = parseSteps(REAL);
  const names = steps.map((s) => s.name).filter(Boolean);
  assert.ok(names.includes("Start local backend"));
  assert.ok(names.includes("Delete temporary backend"));
  const start = steps.find((s) => s.name === "Start local backend");
  assert.match(start.run, /supabase start/);
});

const BYPASSES = [
  ["cat log", "cat /tmp/functions-serve.log", /prints a backend log without the guard/],
  ["tail log", "tail -n 50 /tmp/supabase-start.log", /prints a backend log without the guard/],
  ["grep log", 'grep error /tmp/revoked-test.log', /grep prints matching log lines/],
  ["tee test output", "deno test x.ts 2>&1 | tee /tmp/revoked-test.log", /tee copies output/],
  ["start unredirected", "supabase start", /prints backend keys straight/],
  ["status unredirected", "supabase status", /prints backend keys straight/],
  ["serve unredirected", "supabase functions serve guest-booking-portal &", /prints backend keys straight/],
  ["docker logs", "docker logs supabase_db", /prints backend keys straight/],
  ["env dump", "env", /prints backend keys straight/],
  ["printenv", "printenv | sort", /prints backend keys straight/],
  ["shell tracing", "set -x", /shell tracing/],
  ["echo token", 'echo "token is $TOKEN"', /prints a credential variable/],
  ["echo key", "echo $SERVICE_ROLE_KEY", /prints a credential variable/],
  ["echo db url", 'printf "%s" "$DB_URL"', /prints a credential variable/],
  ["job summary", "cat notes.txt >> $GITHUB_STEP_SUMMARY", /job summary/],
  ["unscanned log", "some-tool > /tmp/extra.log 2>&1", /\/tmp\/extra\.log: written by the workflow but never scanned/],
];

for (const [name, run, expected] of BYPASSES) {
  test(`flags a step that bypasses the guard: ${name}`, () => {
    const problems = checkWorkflow(withStep(`Planted ${name}`, run));
    assert.ok(
      problems.some((p) => expected.test(p)),
      `expected ${expected} in:\n${problems.join("\n")}`,
    );
    if (!/written by the workflow/.test(expected.source))
      assert.ok(problems.some((p) => p.includes(`Planted ${name}`)), "names the step");
  });
}

test("flags artifact uploads", () => {
  const wf = REAL.replace(
    "      - name: Check logs hold no credentials",
    "      - name: Upload logs\n        uses: actions/upload-artifact@v4\n        with:\n          path: /tmp/*.log\n\n      - name: Check logs hold no credentials",
  );
  assert.ok(checkWorkflow(wf).some((p) => /Upload logs: saves files outside the job/.test(p)));
});

test("flags a workflow with no final scan", () => {
  const wf = REAL.replace(/guest-link-log-guard\.sh scan/g, "true");
  assert.ok(checkWorkflow(wf).some((p) => /no final credential scan/.test(p)));
});

const ALLOWED = [
  ["guarded print", "scripts/ci/guest-link-log-guard.sh filter /tmp/functions-serve.log 40"],
  ["quiet grep", 'grep -q "1 passed" /tmp/revoked-test.log'],
  ["redirected start", "supabase start > /tmp/supabase-start.log 2>&1"],
  ["captured status", 'eval "$(supabase status -o env)"'],
  ["mask", 'echo "::add-mask::$TOKEN"'],
  ["env file", 'echo "GUEST_LINK_TOKEN=$TOKEN" >> "$GITHUB_ENV"'],
  ["warning text", 'echo "::warning::supabase start attempt failed"'],
  ["tee to nowhere", "echo hi | tee /tmp/x.txt > /dev/null"],
];

for (const [name, run] of ALLOWED) {
  test(`allows a safe step: ${name}`, () => {
    assert.deepEqual(checkWorkflow(withStep(`Safe ${name}`, run)), []);
  });
}
