# CI Placeholder IDs

Several legacy seed migrations under `supabase/migrations/` reference
hardcoded production UUIDs (a tenant, sites, and a staff user). When
the local Supabase stack is booted from scratch in CI, those rows do
not exist, and the seed migrations fail with foreign key constraint
errors such as:

```
insert or update on table "site_users" violates foreign key constraint
"site_users_site_id_fkey"

insert or update on table "site_settings" violates foreign key constraint
"site_settings_site_id_fkey"
```

To keep CI green without rewriting the historical migrations, each
workflow that boots a local Supabase stack injects CI-only migrations
**before** running `supabase start`. The tenant placeholder runs right
after the `tenants` table exists, and the site placeholders run right
after the `sites` table exists. Together they pre-create placeholder
rows with the exact IDs the legacy seeds expect, so the seeds can attach
to them via `ON CONFLICT DO NOTHING`.

## Placeholder IDs (do not change)

| Purpose                  | Table          | ID                                       |
| ------------------------ | -------------- | ---------------------------------------- |
| Placeholder tenant owner | `auth.users`   | `00000000-0000-0000-0000-0000000000c1`   |
| Legacy staff user        | `auth.users`   | `ea50e91e-5dbf-4dcc-a13c-f96c4016f952`   |
| Placeholder tenant       | `public.tenants` | `9ac05fbf-0834-44fd-a52a-d030b7074a30` |
| Legacy site user site    | `public.sites` | `b040ab30-f4d2-45cc-8695-2000572428d7`   |
| Legacy site settings site | `public.sites` | `51fb4748-3b84-471a-b9a0-b5aac88191b9`  |

The tenant is seeded as `tier = 'business'`, `is_active = true`,
`subscription_status = 'active'` so trigger and tier checks behave
predictably. The sites are seeded as `is_active = true` and are owned by
the placeholder tenant.

## Where the IDs are injected

Workflows write the same `supabase/migrations/20260224082115_ci_placeholder_tenant.sql`
and `supabase/migrations/20260303093524_ci_placeholder_site.sql` files in
a step named **"Inject placeholder tenant for local-only seed data"**, which
runs after the Supabase CLI install and before `supabase start`:

- `.github/workflows/tier-trigger-tests.yml` , runs the raw psql
  trigger regression tests in `supabase/tests/*.sql`.
- `.github/workflows/reservation-type-limit-live.yml` , runs the
  end-to-end vitest suite in `supabase/tests/integration/` against a
  real PostgREST + Postgres stack.

The cross-tenant RLS workflow
(`.github/workflows/cross-tenant-rls-local.yml`) uses the same pattern
and is the original source of these IDs.

## When to update this doc

Update the table above (and the inject steps in every workflow) if:

1. A new legacy migration starts referencing a different hardcoded
   production ID. Add the new ID and a corresponding placeholder row.
2. The site placeholder timestamp changes. It must stay after
   `20260303093523_*` where `public.sites` is created and before
    `20260303123922_*` where the legacy `site_users` seed runs, and
    before `20260303152539_*` where the legacy `site_settings` seed runs.
3. An existing legacy migration is rewritten to stop depending on
   hardcoded IDs. Remove the now-unused row from every workflow and
   from the table.
4. A new CI workflow boots a local Supabase stack. Copy the
   "Inject placeholder tenant for local-only seed data" step verbatim
   so the seeds keep applying cleanly.

Keeping the inject step identical across workflows is intentional. If
they drift, one CI job will pass while another fails on the same
migration, which is exactly the failure mode this doc exists to
prevent.
