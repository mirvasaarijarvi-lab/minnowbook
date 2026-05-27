// Shared CI helper: resolve a caller-supplied path and assert it stays
// within an allowed root (defaults to the repo root = process.cwd()).
//
// These scripts only run in GitHub Actions on trusted, repo-controlled
// inputs (test reports, lockfiles, the flaky-tests manifest, repo file
// walks). They never execute in the deployed app and never accept input
// from end users. This guard is defense-in-depth: it ensures that even
// if a CI workflow or env var is ever misconfigured, readFileSync calls
// cannot be redirected outside the checkout to read host secrets like
// /etc/passwd or ~/.ssh/id_rsa.

import { resolve, relative, isAbsolute } from "node:path";

/**
 * Resolve `input` and assert it is inside `root`. Throws on traversal.
 * Returns the absolute, normalized path on success.
 */
export function safeResolveWithin(input, root = process.cwd()) {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("safeResolveWithin: path must be a non-empty string");
  }
  const absRoot = resolve(root);
  const absPath = resolve(absRoot, input);
  const rel = relative(absRoot, absPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `Refusing to read path outside repo root: ${input} (resolved to ${absPath})`,
    );
  }
  return absPath;
}
