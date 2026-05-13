import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Security-only test runner.
 *
 * This config exists to answer ONE question on every push: "Are the
 * security invariants still holding?" — without paying for unrelated
 * unit tests or, crucially, performance/benchmark suites that don't
 * assert on a security contract.
 *
 * Inclusion rule (allow-list, not deny-list):
 *   We only run files under `src/test/security/` plus a small set of
 *   colocated security-relevant unit tests (auth, permissions, RLS
 *   manifests, edge-function security helpers). Anything not on the
 *   list is skipped by construction — new perf/benchmark files cannot
 *   accidentally bleed into this runner.
 *
 * Exclusion rule:
 *   Files matching `*.perf.test.*`, `*.bench.test.*`, `*.benchmark.*`,
 *   or anything inside a `perf/` or `benchmarks/` directory are
 *   excluded even if they live under `src/test/security/`. This way a
 *   performance probe (e.g. "log isolation query latency") can be
 *   colocated with the security suite for context but won't gate CI
 *   on flaky timing.
 *
 * Run with:  bunx vitest run --config vitest.security.config.ts
 *     or:    bun run test:security
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Security tests routinely hit live Edge Functions, the Supabase
    // REST gateway, and auth endpoints. A single cold-start or transient
    // network blip can easily blow past Vitest's default 5s timeout, so
    // raise the default for this runner instead of sprinkling per-test
    // `{ timeout: ... }` overrides across the suite. Individual tests
    // can still tighten the budget when they assert on latency.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: [
      // Primary security regression suite.
      "src/test/security/**/*.{test,spec}.{ts,tsx}",
      // Colocated unit tests that assert on security contracts
      // (privilege checks, error sanitisation, tier limits).
      "src/components/SystemAdminRoute.test.tsx",
      "src/components/ProtectedRoute.superadmin.test.tsx",
      "src/components/dashboard/AdminPanel.tierLimit.test.tsx",
      "src/hooks/useIsSystemAdmin.invalidate.test.tsx",
      "src/pages/Forbidden.test.tsx",
      "src/pages/Forbidden.audit.test.tsx",
      "src/pages/Forbidden.beacon.test.tsx",
      "src/pages/Forbidden.adminCheckState.test.tsx",
      "src/lib/tier-error-codes.test.ts",
      "src/lib/staff-limit-trigger.regression.test.ts",
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      // Performance / benchmark probes — useful signal, but not a
      // security gate. Keep them runnable on demand via the default
      // vitest config but never via the security runner.
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
