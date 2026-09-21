#!/usr/bin/env node
// Guarantees that `vite preview` (the Playwright webServer) has something it can
// actually run.
//
// The deploy build targets Cloudflare (nitro preset cloudflare-module), whose
// output is dist/server/index.mjs and needs Cloudflare bindings such as
// env.ASSETS. `vite preview` instead imports dist/server/server.js and serves it
// on plain Node, so after a deploy-shape build every Playwright run failed with
//   Cannot find module '.../dist/server/server.js'
// and then HTTP 500 on every page.
//
// E2E_PREVIEW_BUILD=1 (handled in vite.config.ts) disables the nitro deploy
// plugin so the plain TanStack Start server bundle is emitted at
// dist/server/server.js. This script builds that shape when it is missing and
// stays a no-op when CI already produced it.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// react and react-dom must be the exact same installed version, or the SSR
// preview server aborts on boot with "Incompatible React versions" and every
// Playwright page comes back as ERR_CONNECTION_REFUSED / 500. A divergence here
// always means a stale or partially restored node_modules, never app code, so
// fail up front with the fix instead of 100 unexplained test failures.
function installedVersion(pkg) {
  const manifest = resolve(process.cwd(), "node_modules", pkg, "package.json");
  if (!existsSync(manifest)) return null;
  try {
    return JSON.parse(readFileSync(manifest, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function reactVersions() {
  return [installedVersion("react"), installedVersion("react-dom")];
}

let [reactVersion, reactDomVersion] = reactVersions();

if (reactVersion && reactDomVersion && reactVersion !== reactDomVersion) {
  // A stale or partially restored node_modules is a machine-state problem, not
  // an app-code problem, so repair it once instead of failing the whole run.
  console.warn(
    `[e2e] Incompatible React versions installed: react ${reactVersion} vs react-dom ${reactDomVersion}.\n` +
      "[e2e] Repairing node_modules with a frozen install ...",
  );

  const reinstall = spawnSync(
    "bun",
    ["install", "--frozen-lockfile", "--force"],
    { stdio: "inherit", env: process.env },
  );

  [reactVersion, reactDomVersion] = reactVersions();

  if (
    reinstall.status !== 0 ||
    !reactVersion ||
    !reactDomVersion ||
    reactVersion !== reactDomVersion
  ) {
    console.error(
      `[e2e] Still incompatible after reinstall: react ${reactVersion} vs react-dom ${reactDomVersion}.\n` +
        "[e2e] Run locally and commit the result:\n" +
        "[e2e]   rm -rf node_modules bun.lock && bun install",
    );
    process.exit(1);
  }

  console.log(
    `[e2e] node_modules repaired, react ${reactVersion} matches react-dom.`,
  );
}

const serverEntry = resolve(process.cwd(), "dist/server/server.js");

if (existsSync(serverEntry)) {
  console.log(
    "[e2e] dist/server/server.js present, reusing the existing preview build.",
  );
  process.exit(0);
}

console.log(
  "[e2e] dist/server/server.js missing, building with E2E_PREVIEW_BUILD=1 ...",
);

const result = spawnSync("bunx", ["vite", "build"], {
  stdio: "inherit",
  env: { ...process.env, E2E_PREVIEW_BUILD: "1" },
});

if (result.status !== 0) {
  console.error("[e2e] preview build failed");
  process.exit(result.status ?? 1);
}

if (!existsSync(serverEntry)) {
  console.error(
    "[e2e] build finished but dist/server/server.js is still missing. " +
      "Check that vite.config.ts honours E2E_PREVIEW_BUILD=1 (nitro: false).",
  );
  process.exit(1);
}
