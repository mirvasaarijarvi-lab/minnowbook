CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public._temp_create_test_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'staff-test@mimmin.fi';
  
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, confirmation_token,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated',
      'staff-test@mimmin.fi',
      extensions.crypt('TestStaff2026!x', extensions.gen_salt('bf')),
      now(), now(), now(), '',
      '{"provider":"email","providers":["email"]}',
      '{}', false
    ) RETURNING id INTO v_user_id;

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id, 'staff-test@mimmin.fi',
      jsonb_build_object('sub', v_user_id::text, 'email', 'staff-test@mimmin.fi'),
      'email', now(), now(), now());
  END IF;

  INSERT INTO public.tenant_users (tenant_id, user_id, role, display_name, is_approved)
  VALUES ('9ac05fbf-0834-44fd-a52a-d030b7074a30', v_user_id, 'staff', 'Testi Työntekijä', true)
  ON CONFLICT DO NOTHING;
END;
$$;

SELECT public._temp_create_test_user();
DROP FUNCTION public._temp_create_test_user();
