import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["list"],
  ],
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:4173",
    // Capture diagnostics on failure so booking, offer, and reservation
    // regressions are easy to triage from the HTML report.
    // Always capture trace + video on the first attempt and on every retry,
    // so cross-booking divergences between attempts can be compared side by side.
    trace: "on",
    screenshot: "on",
    video: "on",
  },
  webServer: {
    command: "bunx vite preview --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
