#!/usr/bin/env node
// Step-level lint for the guest link workflow: flags any step whose log
// output or saved files could skip the secret-scanning guard
// (scripts/ci/guest-link-log-guard.sh). No dependencies, so it runs before
// any install.
//
// Usage: node scripts/ci/guest-link-step-guard.mjs [workflow.yml]
// Exit 1 and one "step: problem" line per finding when something bypasses.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const GUARD = "guest-link-log-guard.sh";
const LOG_FILE = /\/tmp\/[\w.-]+\.log/g;
const SECRET_VAR =
  /\$\{?(TOKEN|GUEST_LINK_TOKEN|[A-Z_]*(KEY|SECRET|PASSWORD|DB_URL|JWT)[A-Z_]*)\}?/;

/** Split a workflow into steps: { job, name, uses, run, line }. */
export function parseSteps(text) {
  const lines = text.split("\n");
  const steps = [];
  let job = null;
  let inSteps = false;
  let stepIndent = -1;
  let cur = null;
  let runIndent = -1;
  lines.forEach((raw, i) => {
    const indent = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (cur && runIndent >= 0) {
      if (t === "" || indent >= runIndent) {
        cur.run += raw.slice(Math.min(runIndent, raw.length)) + "\n";
        return;
      }
      runIndent = -1;
    }
    if (/^ {2}[\w-]+:\s*$/.test(raw)) {
      job = t.slice(0, -1);
      inSteps = false;
      return;
    }
    if (t === "steps:") {
      inSteps = true;
      stepIndent = -1;
      return;
    }
    if (!inSteps || t.startsWith("#") || t === "") return;
    if (t.startsWith("- ") && (stepIndent < 0 || indent === stepIndent)) {
      stepIndent = indent;
      cur = { job, name: null, uses: null, run: "", line: i + 1 };
      steps.push(cur);
    }
    if (!cur) return;
    const kv = t.replace(/^- /, "");
    const m = kv.match(/^(name|uses|run):\s*(.*)$/);
    if (!m) return;
    if (m[1] === "run") {
      if (m[2] === "|" || m[2] === "|-" || m[2] === ">") runIndent = indent + 2;
      else cur.run = m[2] + "\n";
    } else cur[m[1]] = m[2].replace(/\s+#.*$/, "");
  });
  return steps;
}

/** Shell lines with comments dropped and `\` continuations joined. */
function shellLines(run) {
  return run
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export function checkWorkflow(text) {
  const steps = parseSteps(text);
  const problems = [];
  const written = new Set();
  const scanned = new Set();
  const deleted = new Set();
  const label = (s) =>
    `${s.job} / ${s.name ?? s.uses ?? `step at line ${s.line}`}`;

  for (const s of steps) {
    const who = label(s);
    if (
      s.uses &&
      /upload-artifact|cache\/save|actions\/cache@|upload-pages-artifact|codecov/.test(
        s.uses,
      )
    )
      problems.push(
        `${who}: saves files outside the job (${s.uses}); these are never scanned`,
      );

    for (const l of shellLines(s.run)) {
      const logs = l.match(LOG_FILE) ?? [];
      const viaGuard = l.includes(GUARD);

      if (viaGuard && / scan /.test(l)) logs.forEach((f) => scanned.add(f));
      if (/^rm\b/.test(l)) logs.forEach((f) => deleted.add(f));
      for (const f of logs) {
        if (new RegExp(`(>>?|tee( -a)?)\\s*${f.replace(/\./g, "\\.")}`).test(l))
          written.add(f);
      }

      if (/GITHUB_STEP_SUMMARY/.test(l))
        problems.push(
          `${who}: writes to the job summary, which is never scanned: ${l}`,
        );

      if (/\btee\b/.test(l) && !/\btee\b[^|]*>\s*\/dev\/null/.test(l))
        problems.push(
          `${who}: tee copies output straight to the log, skipping the guard: ${l}`,
        );

      if (
        !viaGuard &&
        logs.length &&
        /(^|[|;&(]\s*)(cat|tail|head|less|more|sed|awk|nl|strings|xxd|od)\b/.test(
          l,
        )
      )
        problems.push(`${who}: prints a backend log without the guard: ${l}`);
      if (
        !viaGuard &&
        logs.length &&
        /(^|[|;&(]\s*)grep\b/.test(l) &&
        !/grep\s+-[a-zA-Z]*[qc]/.test(l)
      )
        problems.push(
          `${who}: grep prints matching log lines without the guard: ${l}`,
        );

      // Text inside $(...) is captured, and quoted echo text is just words.
      const bare = /^(echo|printf)\b/.test(l)
        ? ""
        : l.replace(/\$\([^)]*\)/g, "");
      const redirected =
        />\s*\S/.test(bare) || /\|\s*(while|python3|xargs)\b/.test(bare);
      if (
        /\b(supabase\s+(start|status|functions\s+serve)|docker\s+logs|printenv)\b|^env\s*$|^env\s*\|/.test(
          bare,
        ) &&
        !redirected
      )
        problems.push(
          `${who}: command prints backend keys straight to the log: ${l}`,
        );
      if (/^set\s+-[a-z]*x/.test(l) || /bash\s+-x\b/.test(l))
        problems.push(
          `${who}: shell tracing prints every value, including keys: ${l}`,
        );

      if (
        /^(echo|printf)\b/.test(l) &&
        SECRET_VAR.test(l) &&
        !/::add-mask::/.test(l) &&
        !/>>\s*"?\$GITHUB_ENV/.test(l)
      )
        problems.push(`${who}: prints a credential variable: ${l}`);
    }
  }

  for (const f of written)
    if (!scanned.has(f) && !deleted.has(f))
      problems.push(
        `${f}: written by the workflow but never scanned by the guard or deleted`,
      );
  if (!steps.some((s) => s.run.includes(`${GUARD} scan`)))
    problems.push("workflow has no final credential scan step");
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file =
    process.argv[2] ?? ".github/workflows/guest-link-local-backend.yml";
  const problems = checkWorkflow(readFileSync(file, "utf8"));
  if (problems.length) {
    for (const p of problems) console.log(`::error::${p}`);
    console.log(`${problems.length} step(s) bypass the secret-scanning guard.`);
    process.exit(1);
  }
  console.log(
    "Every step's logs and files go through the secret-scanning guard.",
  );
}
