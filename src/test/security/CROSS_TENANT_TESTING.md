# Cross-Tenant RLS & Storage Isolation Tests

This directory contains automated tests that verify **multi-tenant data isolation**
at the database (RLS) and storage (bucket policy) layers. They are the last line
of defence against a class of bugs that's invisible in normal app testing:
queries that *look* correct from one tenant's session but silently leak rows
from another tenant.

## Policy contract

The exact per-table SELECT/INSERT/UPDATE/DELETE expectations these tests
enforce live in [`RLS_EXPECTATIONS.md`](./RLS_EXPECTATIONS.md). Update that
matrix in the same PR as any policy migration so the suite, the docs, and
the live schema stay aligned.

## Test files

| File | What it covers |
|------|----------------|
| [`cross-tenant-rls.test.ts`](./cross-tenant-rls.test.ts) | Row-Level Security on `reservations`, `notifications`, `offers`, `audit_log`, `tenant_users`, etc. — covers SELECT, INSERT, UPDATE, DELETE denial across tenants. |
| [`cross-tenant-storage.test.ts`](./cross-tenant-storage.test.ts) | Storage bucket policies on `tenant-private` and `tenant-assets` — covers upload, download, list, overwrite (upsert), and delete denial across tenants. |

Both suites have **two modes**:

### 1. Anon mode (always runs in CI)

Uses an unauthenticated client to confirm:

- Anonymous users cannot read tenant tables.
- Anonymous users cannot upload, download, list, or delete files.

Requires only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, which are
already in `.env`. These tests run as part of the standard
`Security Regression Tests` workflow on every push and PR.

### 2. Live mode (opt-in via secrets)

Signs in as **two real users from two different tenants** and asserts that:

- Each user CAN read/write their own tenant's data (positive control).
- Neither user can SELECT, INSERT, UPDATE, or DELETE rows belonging to the
  other tenant.
- Neither user can upload, download, list, overwrite, or delete files in the
  other tenant's storage folder.

Live mode is the only way to catch RLS policies that are correctly *defined*
in migrations but accidentally *bypassed* by app code or wrong policy logic
(e.g. a `USING (true)` policy, or a SECURITY DEFINER function that doesn't
filter by `auth.uid()`).

## Running live mode locally

```bash
RLS_TEST_TENANT_A_EMAIL=user-a@example.com \
RLS_TEST_TENANT_A_PASSWORD='...' \
RLS_TEST_TENANT_A_ID=00000000-0000-0000-0000-000000000001 \
RLS_TEST_TENANT_B_EMAIL=user-b@example.com \
RLS_TEST_TENANT_B_PASSWORD='...' \
RLS_TEST_TENANT_B_ID=00000000-0000-0000-0000-000000000002 \
bunx vitest run \
  src/test/security/cross-tenant-rls.test.ts \
  src/test/security/cross-tenant-storage.test.ts
```

Without these env vars the live tests are skipped (via `describe.runIf`); the
anon tests still run.

## Setting up live mode in GitHub Actions

A ready-to-go workflow lives at
[`.github/workflows/cross-tenant-rls.yml`](../../../.github/workflows/cross-tenant-rls.yml).
It runs on every push to `main`, every PR, and once daily at 06:00 UTC.

### One-time setup

1. **Pick a Supabase project for testing.** Strongly recommend a *staging*
   project, not production. The tests create and delete throwaway files; they
   never touch real customer data, but staging keeps the blast radius zero.

2. **Create two test tenants** in that project. The easiest way is to log in
   as a normal user twice (with two different emails) and complete the
   onboarding flow each time — that gives you two fully-formed tenants with
   distinct IDs.

3. **Capture the credentials and tenant IDs:**
   - From `auth.users`: each test user's email + the password you set.
   - From `tenants`: the `id` column for each tenant.

4. **Confirm both users are members of their tenant** — check that
   `tenant_users.is_approved = true` for each. Without approval the positive-
   control sanity tests will fail and the suite will be unreliable.

5. **Add the secrets to GitHub.**
   Go to **Repository → Settings → Secrets and variables → Actions → New
   repository secret** and add all 8:

   | Secret name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | The publishable (anon) key |
   | `RLS_TEST_TENANT_A_EMAIL` | Test user A's email |
   | `RLS_TEST_TENANT_A_PASSWORD` | Test user A's password |
   | `RLS_TEST_TENANT_A_ID` | Tenant A's UUID |
   | `RLS_TEST_TENANT_B_EMAIL` | Test user B's email |
   | `RLS_TEST_TENANT_B_PASSWORD` | Test user B's password |
   | `RLS_TEST_TENANT_B_ID` | Tenant B's UUID |

6. **(Optional) Trigger a manual run** to verify everything wired up correctly:
   *Actions → Cross-Tenant RLS (Live Mode) → Run workflow*.

### What you'll see

- **Secrets configured:** the `cross-tenant-live` job runs both suites in live
  mode. A red build means *a real RLS regression* — investigate immediately.
- **Secrets missing:** the `skipped-notice` job emits a workflow notice and
  the live job is skipped. CI stays green; anon-mode coverage continues to
  run via the `Security Regression Tests` workflow.

## What good looks like

A passing live-mode run proves, end to end:

1. Tenant A's session can read/write Tenant A's rows and files.
2. Tenant A's session **cannot** read Tenant B's rows or files.
3. Tenant A's session **cannot** insert, update, or delete Tenant B's rows
   (RLS `WITH CHECK` is enforced on writes, not just `USING` on reads).
4. The same is true symmetrically for Tenant B.
5. Storage paths are scoped by `{tenant_id}/...` and the bucket policies
   enforce that prefix.

If any one of these breaks, the corresponding test will fail with a clear
message pointing at the table or bucket involved.

## Troubleshooting

- **All live tests pass even though I expected a failure.** Double-check the
  positive-control sanity tests passed too. If those failed silently you may
  be authenticating as a user with no tenant membership — every cross-tenant
  request will be denied trivially and the suite will look green.
- **`Tenant A sign-in failed: Invalid login credentials`.** Confirm the user
  exists in `auth.users`, the email is confirmed, and the password is correct.
- **Anon storage tests time out in CI.** The suite already wraps anon uploads
  in a 4-second race. If you still see timeouts, the network from CI to
  Supabase is degraded — the test treats timeout as denial, which is the
  safe default.
