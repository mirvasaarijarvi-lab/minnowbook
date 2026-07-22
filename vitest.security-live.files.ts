/**
 * Single source of truth for which security tests are LIVE integration
 * tests (they dial Supabase, deployed Edge Functions, or other network
 * services) versus pure unit tests (static scans, validators, mocked
 * components).
 *
 * Two configs consume this list:
 *
 *   - `vitest.security.config.ts` (unit runner, every push/PR):
 *       EXCLUDES this list so the unit gate is fully offline,
 *       deterministic, and cheap.
 *
 *   - `vitest.security-live.config.ts` (scheduled job + manual dispatch):
 *       INCLUDES only this list so the live gate exercises the real
 *       Supabase/Edge stack on a cron schedule, where cold-start and
 *       network variance are acceptable.
 *
 * Keeping the inventory in one file prevents the two runners from
 * drifting (a test that's excluded from unit MUST be included in live,
 * or it stops running entirely).
 *
 * When you add a new security test:
 *   - If it touches the network (fetch to functions/v1, supabase auth,
 *     storage API, etc.), append it here.
 *   - If it's purely local (regex/static scan, mocked component, pure
 *     function), leave it out — it will be picked up by the unit runner.
 */
export const LIVE_SECURITY_TESTS: string[] = [
  "src/test/security/anon-access-audit.test.ts",
  "src/test/security/audit-log-append-only.test.ts",
  "src/test/security/booking-token-enumeration.test.ts",
  "src/test/security/booking-token-expired.test.ts",
  "src/test/security/booking-token-lookup.test.ts",
  "src/test/security/booking-token-revoked.test.ts",
  "src/test/security/booking-token-tenant-isolation.test.ts",
  "src/test/security/code-redemption-authenticated-e2e.test.ts",
  "src/test/security/code-redemption-authenticated-replay.test.ts",
  "src/test/security/code-redemption-authorized-concurrency.test.ts",
  "src/test/security/code-redemption-concurrency.test.ts",
  "src/test/security/code-redemption-cross-tenant.test.ts",
  "src/test/security/code-redemption-e2e-rate-limit.test.ts",
  "src/test/security/code-redemption-idempotency.test.ts",
  "src/test/security/code-redemption-rate-limit.test.ts",
  "src/test/security/code-redemption-same-idem-key-concurrency.test.ts",
  "src/test/security/cross-tenant-log-isolation.test.ts",
  "src/test/security/cross-tenant-rls.test.ts",
  "src/test/security/cross-tenant-storage.test.ts",
  "src/test/security/custom-role-key-assignment-db.test.ts",
  "src/test/security/duplicate-tenant-membership.test.ts",
  "src/test/security/edge-function-cold-start-retry.test.ts",
  "src/test/security/edge-function-cors-allowlist-coverage.test.ts",
  "src/test/security/edge-function-cors-cacheability.test.ts",
  "src/test/security/edge-function-cors-custom-headers.test.ts",
  "src/test/security/edge-function-cors-origin.test.ts",
  "src/test/security/edge-function-disallowed-origin-403.test.ts",
  "src/test/security/forbidden-access-audit.integration.test.ts",
  "src/test/security/guest-reviews-and-tenants-rls.test.ts",
  "src/test/security/pagination-negative-rls.test.ts",
  "src/test/security/redeem-preflight.test.ts",
  "src/test/security/resource-images-anon-by-id.test.ts",
  "src/test/security/resource-images-anon-cross-tenant.test.ts",
  "src/test/security/resource-images-anon-pagination.test.ts",
  "src/test/security/resource-images-anon-select.test.ts",

  "src/test/security/session-persistence.test.tsx",
  "src/test/security/storage-offer-pdf-isolation.test.ts",
  "src/test/security/tenant-assets-private.test.ts",
  "src/test/security/tenant-scoped-anon-vs-auth.test.ts",
  "src/test/security/tenant-table-manifest.test.ts",
];
