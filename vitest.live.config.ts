/**
 * Vitest config for LIVE integration tests that hit a real Supabase
 * stack over the network. These tests are intentionally separated from
 * the default `vitest.config.ts` (which only includes `src/**`) so
 * `npm test` never tries to dial a non-existent database during local
 * development. CI runs them via:
 *
 *   bunx vitest run --config vitest.live.config.ts
 *
 * The corresponding workflow lives at
 * `.github/workflows/reservation-type-limit-live.yml`.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["supabase/tests/integration/**/*.test.ts"],
    // Live DB calls are slow and serial-only to avoid trigger-state
    // races between parallel workers using the same Postgres.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
