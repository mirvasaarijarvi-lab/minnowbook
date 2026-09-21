#!/usr/bin/env node
/**
 * GitHub Action version gate.
 *
 * Runs BEFORE anything else in CI (see the pre-build gate in
 * .github/workflows/ci.yml) and rejects:
 *
 *   1. mutable refs        - `@main`, `@master`, `@v4`, or no ref at all
 *   2. drift               - a pin that differs from .github/action-versions.json
 *   3. inconsistency       - the same action pinned to two different commits in
 *                            different jobs/workflows (this is what broke the
 *                            CodeQL wrap-up step: init/analyze on v4.38.1 while
 *                            upload-sarif was still on v4.38.0)
 *   4. deprecated versions - a version comment at or below the recorded
 *                            deprecated major for that action
 *   5. undocumented pins   - a SHA with no `# vX.Y.Z` comment, or an action
 *                            missing from the manifest entirely
 *
 * Usage:
 *   node scripts/ci/check-action-versions.mjs            # verify (exit 1 on problems)
 *   node scripts/ci/check-action-versions.mjs --fix      # rewrite refs to the manifest
 *   node scripts/ci/check-action-versions.mjs --json     # machine-readable report
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = process.cwd();
export const MANIFEST_PATH = ".github/action-versions.json";

const SHA_RE = /^[0-9a-f]{40}$/;
const VERSION_RE = /^v(\d+)(?:\.\d+){0,2}$/;
const MUTABLE_BRANCHES = new Set([
  "main",
  "master",
  "HEAD",
  "develop",
  "latest",
]);

/** Parse `uses:` lines out of a workflow / composite-action file. */
export function parseUsesRefs(content, file = "<memory>") {
  const refs = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const match =
      /^\s*(?:-\s*)?uses:\s*(['"]?)([^'"\s#]+)\1\s*(?:#\s*(.*?))?\s*$/.exec(
        lines[i],
      );
    if (!match) continue;
    const raw = match[2];
    const comment = (match[3] ?? "").trim();
    if (raw.startsWith("./") || raw.startsWith("docker://")) continue;
    const at = raw.indexOf("@");
    refs.push({
      file,
      line: i + 1,
      action: at === -1 ? raw : raw.slice(0, at),
      ref: at === -1 ? null : raw.slice(at + 1),
      comment,
      commentVersion: VERSION_RE.test(comment.split(/\s+/)[0] ?? "")
        ? comment.split(/\s+/)[0]
        : null,
    });
  }
  return refs;
}

export function majorOf(version) {
  const match = VERSION_RE.exec(version ?? "");
  return match ? Number(match[1]) : null;
}

/** Turn a list of parsed refs into a list of problems, given the manifest. */
export function collectProblems(refs, manifest) {
  const problems = [];
  const pinsByAction = new Map();

  for (const ref of refs) {
    const expected = manifest.actions?.[ref.action];
    const where = `${ref.file}:${ref.line}`;

    if (!ref.ref) {
      problems.push({
        kind: "missing-ref",
        action: ref.action,
        where,
        message: `${where}: ${ref.action} has no version ref. Pin it to a commit SHA.`,
      });
      continue;
    }

    if (!SHA_RE.test(ref.ref)) {
      const kind = MUTABLE_BRANCHES.has(ref.ref) ? "branch-ref" : "tag-ref";
      problems.push({
        kind,
        action: ref.action,
        where,
        message:
          `${where}: ${ref.action}@${ref.ref} uses a mutable ref. ` +
          `Pin it to ${expected ? `${expected.sha} # ${expected.version}` : "a commit SHA"}.`,
      });
      continue;
    }

    if (!expected) {
      problems.push({
        kind: "unknown-action",
        action: ref.action,
        where,
        message: `${where}: ${ref.action} is not listed in ${MANIFEST_PATH}. Add an entry with its SHA and version.`,
      });
    } else if (ref.ref !== expected.sha) {
      problems.push({
        kind: "drift",
        action: ref.action,
        where,
        message:
          `${where}: ${ref.action} is pinned to ${ref.ref}` +
          `${ref.commentVersion ? ` (${ref.commentVersion})` : ""}, ` +
          `but ${MANIFEST_PATH} requires ${expected.sha} # ${expected.version}.`,
      });
    } else if (!ref.commentVersion) {
      problems.push({
        kind: "missing-version-comment",
        action: ref.action,
        where,
        message: `${where}: ${ref.action} SHA pin has no version comment. Append \`# ${expected.version}\`.`,
      });
    } else if (ref.commentVersion !== expected.version) {
      problems.push({
        kind: "stale-version-comment",
        action: ref.action,
        where,
        message: `${where}: ${ref.action} comment says ${ref.commentVersion} but the pin is ${expected.version}.`,
      });
    }

    const deprecatedMajor = manifest.deprecatedMajors?.[ref.action];
    const major = majorOf(ref.commentVersion);
    if (deprecatedMajor != null && major != null && major <= deprecatedMajor) {
      problems.push({
        kind: "deprecated-version",
        action: ref.action,
        where,
        message:
          `${where}: ${ref.action} ${ref.commentVersion} is deprecated ` +
          `(major ${major} <= ${deprecatedMajor}). Upgrade to ${manifest.actions?.[ref.action]?.version ?? "a supported release"}.`,
      });
    }

    if (!pinsByAction.has(ref.action)) pinsByAction.set(ref.action, new Map());
    const seen = pinsByAction.get(ref.action);
    if (!seen.has(ref.ref)) seen.set(ref.ref, []);
    seen.get(ref.ref).push(where);
  }

  for (const [action, pins] of pinsByAction) {
    if (pins.size < 2) continue;
    const detail = [...pins.entries()]
      .map(([sha, places]) => `${sha.slice(0, 12)} (${places.join(", ")})`)
      .join(" vs ");
    problems.push({
      kind: "inconsistent-version",
      action,
      where: "",
      message: `${action} is used at ${pins.size} different versions: ${detail}. All jobs must use one version.`,
    });
  }

  return problems;
}

/** Rewrite a file's `uses:` lines so every pin matches the manifest. */
export function applyFixes(content, manifest) {
  return content
    .split("\n")
    .map((line) => {
      const match =
        /^(\s*(?:-\s*)?uses:\s*)(['"]?)([^'"\s#]+)\2(\s*#.*)?$/.exec(line);
      if (!match) return line;
      const raw = match[3];
      if (raw.startsWith("./") || raw.startsWith("docker://")) return line;
      const action = raw.includes("@") ? raw.slice(0, raw.indexOf("@")) : raw;
      const expected = manifest.actions?.[action];
      if (!expected) return line;
      return `${match[1]}${action}@${expected.sha} # ${expected.version}`;
    })
    .join("\n");
}

export function loadManifest(root = REPO_ROOT) {
  return JSON.parse(readFileSync(join(root, MANIFEST_PATH), "utf8"));
}

export function listWorkflowFiles(root = REPO_ROOT) {
  const files = [];
  const workflows = join(root, ".github/workflows");
  if (existsSync(workflows)) {
    for (const entry of readdirSync(workflows)) {
      if (/\.ya?ml$/.test(entry)) files.push(join(workflows, entry));
    }
  }
  const actionsDir = join(root, ".github/actions");
  if (existsSync(actionsDir)) {
    for (const entry of readdirSync(actionsDir)) {
      const dir = join(actionsDir, entry);
      if (!statSync(dir).isDirectory()) continue;
      for (const candidate of ["action.yml", "action.yaml"]) {
        const file = join(dir, candidate);
        if (existsSync(file)) files.push(file);
      }
    }
  }
  return files.sort();
}

function main(argv) {
  const fix = argv.includes("--fix");
  const asJson = argv.includes("--json");
  const manifest = loadManifest();
  const files = listWorkflowFiles();

  if (fix) {
    let changed = 0;
    for (const file of files) {
      const before = readFileSync(file, "utf8");
      const after = applyFixes(before, manifest);
      if (before !== after) {
        writeFileSync(file, after);
        changed += 1;
        console.log(`fixed ${relative(REPO_ROOT, file)}`);
      }
    }
    console.log(`Rewrote ${changed} file(s) to match ${MANIFEST_PATH}.`);
  }

  const refs = files.flatMap((file) =>
    parseUsesRefs(readFileSync(file, "utf8"), relative(REPO_ROOT, file)),
  );
  const problems = collectProblems(refs, manifest);

  if (asJson) {
    console.log(
      JSON.stringify(
        { checked: refs.length, files: files.length, problems },
        null,
        2,
      ),
    );
  } else if (problems.length === 0) {
    console.log(
      `GitHub Action versions OK: ${refs.length} pins across ${files.length} workflow file(s), all matching ${MANIFEST_PATH}.`,
    );
  } else {
    console.error(`GitHub Action version problems (${problems.length}):\n`);
    for (const problem of problems)
      console.error(`  [${problem.kind}] ${problem.message}`);
    console.error(
      `\nFix with: node scripts/ci/check-action-versions.mjs --fix` +
        `\nOr update the pin in ${MANIFEST_PATH} first, then re-run with --fix.`,
    );
  }

  if (problems.length > 0) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith("check-action-versions.mjs");
if (invokedDirectly) main(process.argv.slice(2));
