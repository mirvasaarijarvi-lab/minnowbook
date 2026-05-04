-- End-to-end integration test for the Professional tier 5-type cap.
-- Creates a temp auth user + tenant, exercises enforce_reservation_type_limit
-- via real UPDATEs, then cleans everything up. Fails the migration loudly on
-- any regression.

DO $test$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_tenant_id uuid;
  v_err text;
  v_caught boolean;
BEGIN
  -- 1. Create a temp auth user so tenants.owner_user_id FK is satisfied.
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'pro-tier-test+' || substr(v_user_id::text,1,8) || '@example.invalid',
          crypt('not-a-real-password', gen_salt('bf')), now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

  -- 2. Create a Professional-tier tenant owned by that user, starting with 1 type.
  INSERT INTO public.tenants (name, slug, tier, allowed_reservation_types,
                              owner_user_id, subscription_status, is_active)
  VALUES ('TEST_PRO_TIER_RLS', 'test-pro-tier-rls-' || substr(v_user_id::text,1,8),
          'professional', ARRAY['restaurant']::text[], v_user_id, 'trialing', true)
  RETURNING id INTO v_tenant_id;

  -- 3. Updating to exactly 5 mixed types incl. 'custom' must succeed.
  UPDATE public.tenants
  SET allowed_reservation_types =
        ARRAY['restaurant','hotel','guesthouse','venue','custom']::text[]
  WHERE id = v_tenant_id;

  IF (SELECT array_length(allowed_reservation_types,1)
        FROM public.tenants WHERE id = v_tenant_id) <> 5 THEN
    RAISE EXCEPTION 'FAIL: expected 5 types saved, got %',
      (SELECT array_length(allowed_reservation_types,1)
         FROM public.tenants WHERE id = v_tenant_id);
  END IF;

  -- 4. Attempting a 6th type must be rejected by enforce_reservation_type_limit.
  v_caught := false;
  BEGIN
    UPDATE public.tenants
    SET allowed_reservation_types =
          ARRAY['restaurant','hotel','guesthouse','venue','custom','popup']::text[]
    WHERE id = v_tenant_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    v_caught := true;
    IF v_err NOT ILIKE '%at most 5%' THEN
      RAISE EXCEPTION 'FAIL: wrong error for 6 types: %', v_err;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: trigger did not block 6th reservation type for Professional tier';
  END IF;

  -- 5. Verify state was preserved (still 5, no partial write).
  IF (SELECT array_length(allowed_reservation_types,1)
        FROM public.tenants WHERE id = v_tenant_id) <> 5 THEN
    RAISE EXCEPTION 'FAIL: tenant state changed after rejected update';
  END IF;

  RAISE NOTICE 'Professional tier RLS/trigger integration test: ALL PASSED';

  -- 6. Cleanup. Delete dependent rows first.
  DELETE FROM public.tenant_users WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  DELETE FROM public.role_permissions WHERE tenant_id = v_tenant_id;
  DELETE FROM public.role_definitions WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tenants WHERE id = v_tenant_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END
$test$;