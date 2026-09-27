-- Seed for the revoked-link integration test on a throwaway LOCAL backend
-- (supabase start in GitHub Actions). Never run against the live project.
-- Relies on the CI placeholder tenant 9ac05fbf-... created by the
-- placeholder migration injected in the workflow.

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
) VALUES (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'ci-guest-portal-owner@example.invalid',
  crypt('ci-guest-portal-password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', '', '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000d1',
  'email',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","email":"ci-guest-portal-owner@example.invalid","email_verified":true}',
  now(), now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_users (user_id, tenant_id, role, is_approved)
VALUES ('00000000-0000-0000-0000-0000000000d1', '9ac05fbf-0834-44fd-a52a-d030b7074a30', 'owner', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.reservations (tenant_id, reservation_type, date, guest_name, guest_email, status)
VALUES (
  '9ac05fbf-0834-44fd-a52a-d030b7074a30', 'custom', current_date + 60,
  'CI Guest', 'ci-guest@example.invalid', 'confirmed'
);
