#!/usr/bin/env node
// Guards two failure classes that have repeatedly broken the
// "Lockfile sync (npm)" and dependency-audit gates:
//
//   1. package-lock.json declares different specifiers than
//      package.json (the audit gate then scans a stale graph, and
//      `npm ci` refuses to install).
//   2. package-lock.json records sandbox-internal / private registry
//      URLs (e.g. europe-west4-npm.pkg.dev/.../sandbox-npm-cache).
//      Those resolve only inside the build sandbox, so CI regenerates
//      a different file every run and the sync gate never goes green.
//
// Usage:
//   node scripts/ci/check-npm-lockfile-hygiene.mjs          # exits 1 on problems
//   node scripts/ci/check-npm-lockfile-hygiene.mjs --json
//
// Importable for tests:
//   import { collectProblems, ALLOWED_REGISTRY_HOSTS } from "./check-npm-lockfile-hygiene.mjs";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

/** Registry hosts a committed lockfile may legitimately point at. */
export const ALLOWED_REGISTRY_HOSTS = Object.freeze([
  "registry.npmjs.org",
  "codeload.github.com",
]);

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Collect every `resolved` URL that is not on a public allowed host. */
export function collectBadRegistryUrls(npmLockJson) {
  const bad = [];
  for (const [path, entry] of Object.entries(npmLockJson.packages ?? {})) {
    const url = entry?.resolved;
    if (typeof url !== "string" || url.length === 0) continue;
    if (url.startsWith("file:") || url.startsWith("link:")) continue;
    const host = hostOf(url);
    if (host === null) {
      bad.push({ path, url, reason: "not a parseable URL" });
      continue;
    }
    if (!ALLOWED_REGISTRY_HOSTS.includes(host)) {
      bad.push({ path, url, reason: `host "${host}" is not a public registry` });
    }
  }
  return bad;
}

/** Diff the manifest's declared ranges against the lockfile root entry. */
export function collectSpecifierDrift(pkgJson, npmLockJson) {
  const root = npmLockJson.packages?.[""] ?? {};
  const drifts = [];
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const expected = pkgJson[field] ?? {};
    const actual = root[field] ?? {};
    const names = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const name of [...names].sort()) {
      const want = expected[name];
      const got = actual[name];
      if (want === got) continue;
      drifts.push({ field, name, manifest: want ?? null, lockfile: got ?? null });
    }
  }
  return drifts;
}

/** Full check over the repository files (or the supplied contents). */
export function collectProblems({ pkgJson, npmLockJson } = {}) {
  const pkgPath = resolve(REPO_ROOT, "package.json");
  const lockPath = resolve(REPO_ROOT, "package-lock.json");

  if (!npmLockJson && !existsSync(lockPath)) {
    return {
      missingLockfile: true,
      specifierDrift: [],
      badRegistryUrls: [],
      ok: false,
    };
  }

  const pkg = pkgJson ?? JSON.parse(readFileSync(pkgPath, "utf8"));
  const lock = npmLockJson ?? JSON.parse(readFileSync(lockPath, "utf8"));

  const specifierDrift = collectSpecifierDrift(pkg, lock);
  const badRegistryUrls = collectBadRegistryUrls(lock);

  return {
    missingLockfile: false,
    specifierDrift,
    badRegistryUrls,
    ok: specifierDrift.length === 0 && badRegistryUrls.length === 0,
  };
}

const FIX = "npm install --package-lock-only --ignore-scripts --no-audit --no-fund";

function main() {
  const asJson = process.argv.includes("--json");
  const result = collectProblems();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.ok ? 0 : 1);
  }

  if (result.missingLockfile) {
    console.error("::error file=package-lock.json::package-lock.json is missing.");
    console.error(`Fix: run \`${FIX}\` and commit the result.`);
    process.exit(1);
  }

  for (const d of result.specifierDrift) {
    console.error(
      `::error file=package-lock.json::${d.field}.${d.name}: package.json says ${
        d.manifest ?? "(absent)"
      }, package-lock.json says ${d.lockfile ?? "(absent)"}`,
    );
  }

  for (const b of result.badRegistryUrls) {
    console.error(
      `::error file=package-lock.json::${b.path}: ${b.reason} (${b.url})`,
    );
  }

  if (!result.ok) {
    console.error("");
    console.error("package-lock.json is not publishable as committed.");
    console.error(
      "Sandbox-internal registry URLs must be rewritten to registry.npmjs.org, and",
    );
    console.error("declared ranges must match package.json exactly.");
    console.error(`Fix: run \`${FIX}\` on a machine using the public registry, then commit.`);
    process.exit(1);
  }

  console.log(
    `package-lock.json hygiene OK (specifiers in sync, all resolved URLs on ${ALLOWED_REGISTRY_HOSTS.join(", ")}).`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
