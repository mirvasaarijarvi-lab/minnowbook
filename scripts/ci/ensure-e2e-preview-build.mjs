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
import { existsSync } from "node:fs";
import { resolve } from "node:path";

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
