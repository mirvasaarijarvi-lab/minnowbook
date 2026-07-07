#!/usr/bin/env node
/**
 * Configures git to use the repo's .githooks directory and ensures hook
 * scripts are executable. Runs automatically via the `prepare` npm lifecycle.
 *
 * Safe to run outside a git checkout: it exits silently.
 */
import { execSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HOOKS_DIR = ".githooks";

function isGitRepo() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (process.env.CI === "true" || process.env.SKIP_GIT_HOOK_SETUP === "1") {
  process.exit(0);
}

if (!isGitRepo() || !existsSync(HOOKS_DIR)) {
  process.exit(0);
}

try {
  execSync(`git config core.hooksPath ${HOOKS_DIR}`, { stdio: "ignore" });
} catch {
  // Not fatal: developer can set this manually.
  process.exit(0);
}

for (const entry of readdirSync(HOOKS_DIR)) {
  const p = join(HOOKS_DIR, entry);
  try {
    if (statSync(p).isFile()) chmodSync(p, 0o755);
  } catch {
    /* ignore */
  }
}

console.log(`[setup-git-hooks] core.hooksPath -> ${HOOKS_DIR}`);
