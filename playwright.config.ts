import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Reruns are now driven by scripts/ci/rerun-flaky.mjs, which retries ONLY
  // tests listed in .github/flaky-tests.json under deterministic settings.
  // Keep retries=0 here so a green CI never silently masks new flake.
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["junit", { outputFile: "test-reports/playwright/junit.xml" }],
    ["json", { outputFile: "test-reports/playwright/results.json" }],
    ["list"],
  ],
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:4173",
    // Sandboxes and CI images occasionally ship a Chromium whose shared
    // libraries are incomplete. E2E_CHROMIUM_PATH lets a run point at a
    // working browser binary without touching the spec files.
    launchOptions: process.env.E2E_CHROMIUM_PATH
      ? { executablePath: process.env.E2E_CHROMIUM_PATH }
      : {},
    // Capture diagnostics on failure so booking, offer, and reservation
    // regressions are easy to triage from the HTML report.
    // Always capture trace + video on the first attempt and on every retry,
    // so cross-booking divergences between attempts can be compared side by side.
    trace: "on",
    screenshot: "on",
    video: "on",
  },
  webServer: {
    // `vite preview` can only serve the plain TanStack Start server bundle
    // (dist/server/server.js). The default deploy build targets Cloudflare and
    // emits dist/server/index.mjs, which made every run fail with
    // ERR_MODULE_NOT_FOUND + HTTP 500. The guard script builds the preview shape
    // when it is missing and is a no-op when CI already built it.
    command:
      "node scripts/ci/ensure-e2e-preview-build.mjs && bunx vite preview --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
