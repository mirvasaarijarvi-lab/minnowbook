## Goal

Stop CI flakes that come from stale logs or leftover DB rows. Every test that touches the DB owns its own tenant, owns its own users, and cleans up. CI fails if anything survives.

## 1. Shared test infrastructure (new files)

```text
src/test/
  fixtures/
    render.tsx            new — renderWithProviders(ui, { tenantId?, language?, queryClient? })
    mock-supabase.ts      new — in-memory supabase mock for unit/security tests
    branding.ts           new — canned persisted/signed URL samples
  helpers/
    ephemeral-tenant.ts   new — createEphemeralTenant() / dropEphemeralTenant() using service-role client
    ephemeral-user.ts     new — createEphemeralUser({ tenantId, role }) with auth.admin
    leftover-guard.ts     new — assertNoLeftoverTestRows() called in global afterAll
```

`renderWithProviders` wraps: `QueryClientProvider` (fresh client, retry: false), `I18nProvider`, `MemoryRouter`, `ImpersonationProvider`, `TenantProvider` (with injected tenantId). Components stop crashing on missing context and tests stop depending on test-file order.

`ephemeral-tenant.ts` creates rows with a deterministic prefix: `slug = `ci-${workerId}-${nanoid(6)}`` and `name = `TEST CI <suite> <nanoid>``. `dropEphemeralTenant` deletes the tenant; cascade handles tenant_users / settings / resources / reservations.

## 2. Vitest unit/integration (`vitest.config.ts`)

- Add `setupFiles: ["./src/test/setup.ts", "./src/test/setup-providers.ts"]`. The new file installs a default `QueryClient` and exposes `renderWithProviders`.
- Migrate component tests that currently call `render()` directly to `renderWithProviders()` (codemod: ripgrep + sed against `src/**/*.test.tsx`). This eliminates the "useImpersonation must be used within ImpersonationProvider" class of failures permanently.
- Add `globalTeardown` that asserts `process.env.CI_LEAK_CHECK !== "1" || noEphemeralFilesLeftover()`.

## 3. Security tests (`vitest.security.config.ts`)

- Default to `setupFiles: ["./src/test/setup.ts", "./src/test/security/setup-mocks.ts"]`.
- `setup-mocks.ts` vi.mocks `@/integrations/supabase/client` with the in-memory mock from `fixtures/mock-supabase.ts` so XSS / branding URL tests never reach the network.
- Cross-tenant storage tests stay live but now seed their own buckets via `ephemeral-tenant.ts` and clean up in `afterAll`.

## 4. Live integration (`vitest.live.config.ts`, `supabase/tests/integration/*`)

- New helper `withEphemeralTenant(testFn)` opens a tenant + users in `beforeAll`, exposes them via the test context, and drops them in `afterAll`. Failures inside the test still trigger cleanup (`try/finally`).
- Rewrite `claim-discount-code.live.test.ts` and `reservation-type-limit.live.test.ts` to use it. No reliance on pre-existing tenant rows.
- Replace any hardcoded UUIDs in `scripts/seed-rls-test-data.ts` callers with values returned from the helper.

## 5. Playwright e2e (`e2e/fixtures/*`)

- Extend `test-tenant.ts` into a Playwright fixture: `test.extend<{ ephemeralTenant: EphemeralTenant }>({...})`. Each spec receives its own tenant; the fixture tears down on `use` end.
- `dashboard-reservations.spec.ts`, `cross-booking-same-guest.spec.ts`, `offer-confirm-creates-reservations.spec.ts`, `tenant-membership-removed.spec.ts` switch to the fixture. No spec reuses another spec's data.
- `public-booking-client.ts` accepts the ephemeral slug instead of a hardcoded `serenity-wellness`.

## 6. Strict leftover-row gate (new CI step)

New SQL helper migration:

```text
public.assert_no_ci_leftover_rows() returns void
  -- raises if any tenants.slug LIKE 'ci-%'
  -- or reservations.guest_name ILIKE 'TEST CI %'
  -- or auth.users.email LIKE 'ci+%@mimmobook.test'
```

New job `ci-leak-check` in `.github/workflows/ci.yml` runs after every test job:

```text
- psql -c "SELECT public.assert_no_ci_leftover_rows();"
```

Job fails the workflow if any leftover exists, so a forgotten cleanup is loud the first time it happens, not the tenth.

## 7. Rollout order (PRs to keep diff reviewable)

1. Shared providers + `renderWithProviders` + migrate component tests.
2. Security test mocks.
3. `withEphemeralTenant` helper + live tests.
4. Playwright fixture conversion.
5. Migration for `assert_no_ci_leftover_rows` + CI workflow gate.

## Technical notes

- Ephemeral users need the service-role key, already in CI as `SUPABASE_SERVICE_ROLE_KEY`. The helper refuses to run when the URL points at production (`assert(url.includes("supabase.co") && url.includes(EXPECTED_REF))`).
- Worker ID comes from `process.env.VITEST_POOL_ID` / `process.env.TEST_WORKER_INDEX` so parallel workers never collide on slugs.
- `QueryClient` in `renderWithProviders` uses `{ retries: false, gcTime: 0 }` to keep tests deterministic.
- `leftover-guard.ts` only runs when `process.env.CI === "true"` so local dev isn't slowed.
- No production code paths change. Only test infra, one new SQL helper, and one new CI job.

## Out of scope

- Rewriting individual assertion logic inside tests (only their setup/teardown changes).
- Edge function Deno tests (already isolated, no shared DB state).
- Refactoring `scripts/seed-rls-test-data.ts` beyond making it idempotent.
