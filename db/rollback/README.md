# Migration rollback companions

This directory holds **rollback companions** for selected forward migrations
under `supabase/migrations/`. It lives outside `supabase/` because
`supabase/migrations/` is managed by the Supabase migration tooling and is
forward-only.

## Important: not applied automatically

Files here are **not** picked up by `supabase db reset`, `supabase db push`,
or `supabase migration up`. They exist to:

1. Provide an audited, reviewed SQL snippet a maintainer can run by hand to
   roll a specific forward migration back in production.
2. Power the automated rollback regression test in
   `.github/workflows/down-migrations.yml`, which boots an ephemeral Postgres,
   applies the forward migration, applies the matching down file, and asserts
   the schema returns to its pre-migration state, then re-applies forward and
   re-asserts.

## Naming

Each file mirrors the forward migration filename it reverses, with a
`.down.sql` suffix:

```
supabase/migrations/20260511101454_<slug>.sql           (forward)
db/rollback/20260511101454_<slug>.down.sql              (reverse)
```

The CI job pairs them by stripping `.down` from the basename and looking up
the forward file under `supabase/migrations/`.

## Coverage

We do **not** require a down file for every migration. We require one for any
migration that creates indexes, tables, or constraints whose presence is
asserted by `src/test/schema/`. Today that is:

- `20260511101454_…sql` — reservations dashboard indexes

Adding a new forward migration that affects schema-gate assertions? Add a
matching `.down.sql` here in the same PR.

## What a good down file does

- Mirrors the forward migration's DDL in reverse order.
- Uses `DROP … IF EXISTS` so it's idempotent and safe to re-run.
- Does **not** drop extensions (e.g. `pg_trgm`) that other migrations may
  depend on. Drop only what the forward file created.
- Does not delete user data. Down migrations are for schema, not rows.
