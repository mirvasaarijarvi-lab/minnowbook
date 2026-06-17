import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { LIVE_SECURITY_TESTS } from "./vitest.security-live.files";

/**
 * Security UNIT test runner.
 *
 * This config answers ONE question on every push/PR: "Are the security
 * invariants still holding *offline*?" — static scans, validators,
 * permission checks, mocked components, regex-based source audits.
 *
 * Live integration tests (anything that dials Supabase or deployed
 * Edge Functions) are intentionally split out into
 * `vitest.security-live.config.ts` and run on a scheduled job, so
 * cold-start / network variance never blocks PR merges.
 *
 * Inclusion rule (allow-list, not deny-list):
 *   We only run files under `src/test/security/` plus a small set of
 *   colocated security-relevant unit tests (auth, permissions, RLS
 *   manifests, edge-function security helpers). Anything not on the
 *   list is skipped by construction — new perf/benchmark files cannot
 *   accidentally bleed into this runner.
 *
 * Exclusion rule:
 *   - Every file listed in `LIVE_SECURITY_TESTS` (single source of
 *     truth shared with the live runner) is excluded here.
 *   - Files matching `*.perf.test.*`, `*.bench.test.*`,
 *     `*.benchmark.*`, or anything inside a `perf/` or `benchmarks/`
 *     directory are excluded even if they live under
 *     `src/test/security/`.
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
    // Even pure unit tests can occasionally do expensive setup
    // (jsdom + react render), so keep a healthy default. The live
    // runner has its own much larger budget.
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
      // Live integration tests run on the scheduled live job, not on
      // every push. Keep this list in sync via the shared module.
      ...LIVE_SECURITY_TESTS,
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

