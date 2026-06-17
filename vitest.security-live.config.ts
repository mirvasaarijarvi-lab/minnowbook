import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { LIVE_SECURITY_TESTS } from "./vitest.security-live.files";

/**
 * Security LIVE integration runner.
 *
 * These tests dial the real Supabase stack and deployed Edge Functions.
 * They are slow, occasionally flaky on cold starts, and require
 * credentials, so they DO NOT run on every push/PR. Instead they run:
 *
 *   - On a scheduled cron (see `.github/workflows/security-tests-live.yml`)
 *   - On manual `workflow_dispatch`
 *   - Locally on demand via `bun run test:security:live`
 *
 * The complementary `vitest.security.config.ts` runs the offline unit
 * gate on every push/PR. The two runners share `LIVE_SECURITY_TESTS`
 * as the single source of truth for which suites belong on which side.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Live calls routinely cold-start, so give every test a generous
    // budget. Individual tests can still tighten the budget when they
    // assert on latency.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    include: LIVE_SECURITY_TESTS,
    exclude: [
      "node_modules/**",
      "dist/**",
      // Performance / benchmark probes — useful signal, but not a
      // security gate. Run on demand via the default vitest config.
      "**/*.perf.test.*",
      "**/*.bench.test.*",
      "**/*.benchmark.*",
      "**/perf/**",
      "**/benchmarks/**",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
