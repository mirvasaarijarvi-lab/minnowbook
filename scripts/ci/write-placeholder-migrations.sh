#!/usr/bin/env bash
# Writes the CI placeholder migrations (copied from reservation-type-limit-live.yml;
# keep in sync, see docs/ci-placeholder-ids.md). Local CI backends only.
set -euo pipefail
cat > supabase/migrations/20260224082115_ci_placeholder_tenant.sql <<'SQL'
-- Placeholder tenant owner
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'ci-placeholder@example.invalid',
  crypt('ci-placeholder-password', gen_salt('bf')),
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Placeholder staff user referenced by legacy site_users seed
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'ea50e91e-5dbf-4dcc-a13c-f96c4016f952',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'ci-placeholder-staff@example.invalid',
  crypt('ci-placeholder-password', gen_salt('bf')),
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- GoTrue listUsers fails with "Database error finding users" when
-- token columns are NULL. Normalize to empty strings.
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR email_change_token_current IS NULL
   OR reauthentication_token IS NULL;

INSERT INTO public.tenants (id, name, slug, tier, is_active, subscription_status, owner_user_id)
VALUES (
  '9ac05fbf-0834-44fd-a52a-d030b7074a30',
  'CI Placeholder Tenant',
  'ci-placeholder-tenant',
  'business', true, 'active',
  '00000000-0000-0000-0000-0000000000c1'
)
ON CONFLICT (id) DO NOTHING;

SQL

# Site placeholders must run AFTER the sites table is created
# (migration 20260303093523_*) and BEFORE legacy seeds that
# reference hardcoded site ids.
cat > supabase/migrations/20260303093524_ci_placeholder_site.sql <<'SQL'
INSERT INTO public.sites (id, tenant_id, name, slug, is_active)
VALUES
  (
    'b040ab30-f4d2-45cc-8695-2000572428d7',
    '9ac05fbf-0834-44fd-a52a-d030b7074a30',
    'CI Placeholder Site',
    'ci-placeholder-site',
    true
  ),
  (
    '51fb4748-3b84-471a-b9a0-b5aac88191b9',
    '9ac05fbf-0834-44fd-a52a-d030b7074a30',
    'CI Placeholder Eventos Site',
    'ci-placeholder-eventos-site',
    true
  )
ON CONFLICT (id) DO NOTHING;
SQL

