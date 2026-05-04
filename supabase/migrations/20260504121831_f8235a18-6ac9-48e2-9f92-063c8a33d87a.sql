DO $test$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_tenant_id uuid;
  v_valid jsonb := '[
    ["custom"],
    ["restaurant","custom"],
    ["hotel","restaurant","custom"],
    ["hotel","restaurant","spa","custom"],
    ["hotel","restaurant","spa","venue","custom"],
    ["hotel","restaurant","spa","venue","activity"],
    ["restaurant","spa","venue","activity","custom"],
    ["hotel","spa","venue","activity","custom"],
    ["hotel"],
    ["hotel","restaurant"],
    ["hotel","restaurant","spa"]
  ]'::jsonb;
  v_invalid jsonb := '[
    ["hotel","restaurant","spa","venue","activity","custom"],
    ["hotel","restaurant","spa","venue","activity","custom","extra1"],
    ["a","b","c","d","e","f"],
    ["a","b","c","d","e","f","g","h"]
  ]'::jsonb;
  v_combo text[];
  v_i int;
  v_pass int := 0;
  v_fail int := 0;
  v_errmsg text;
BEGIN
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'tier-test-' || v_user_id || '@test.local', '', now(), now(), now(), 'authenticated', 'authenticated');

  INSERT INTO public.tenants (name, slug, tier, allowed_reservation_types, owner_user_id, subscription_status)
  VALUES ('Tier Test ' || v_user_id, 'tier-test-' || v_user_id, 'professional', ARRAY['restaurant'], v_user_id, 'trialing')
  RETURNING id INTO v_tenant_id;

  -- Valid combinations
  FOR v_i IN 0..jsonb_array_length(v_valid)-1 LOOP
    SELECT array_agg(value::text) INTO v_combo
    FROM jsonb_array_elements_text(v_valid->v_i);
    BEGIN
      UPDATE public.tenants SET allowed_reservation_types = v_combo WHERE id = v_tenant_id;
      v_pass := v_pass + 1;
      RAISE NOTICE 'PASS valid #% (% types): %', v_i+1, array_length(v_combo,1), v_combo;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE NOTICE 'FAIL valid #% should have been accepted: %', v_i+1, SQLERRM;
    END;
  END LOOP;

  -- Invalid combinations (>5)
  FOR v_i IN 0..jsonb_array_length(v_invalid)-1 LOOP
    SELECT array_agg(value::text) INTO v_combo
    FROM jsonb_array_elements_text(v_invalid->v_i);
    BEGIN
      UPDATE public.tenants SET allowed_reservation_types = v_combo WHERE id = v_tenant_id;
      v_fail := v_fail + 1;
      RAISE NOTICE 'FAIL invalid #% (% types) should have been rejected', v_i+1, array_length(v_combo,1);
    EXCEPTION WHEN OTHERS THEN
      v_errmsg := SQLERRM;
      IF v_errmsg LIKE '%at most 5%' THEN
        v_pass := v_pass + 1;
        RAISE NOTICE 'PASS invalid #% rejected: %', v_i+1, v_errmsg;
      ELSE
        v_fail := v_fail + 1;
        RAISE NOTICE 'FAIL invalid #% wrong error: %', v_i+1, v_errmsg;
      END IF;
    END;
  END LOOP;

  -- Confirm no partial writes
  IF (SELECT array_length(allowed_reservation_types,1) FROM public.tenants WHERE id = v_tenant_id) > 5 THEN
    v_fail := v_fail + 1;
    RAISE NOTICE 'FAIL: partial write detected';
  ELSE
    v_pass := v_pass + 1;
    RAISE NOTICE 'PASS: no partial writes';
  END IF;

  -- Cleanup
  DELETE FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tenant_users WHERE tenant_id = v_tenant_id;
  DELETE FROM public.role_permissions WHERE tenant_id = v_tenant_id;
  DELETE FROM public.role_definitions WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tenants WHERE id = v_tenant_id;
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE '=== Results: % passed, % failed ===', v_pass, v_fail;
  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Tier limit tests FAILED: % failures', v_fail;
  END IF;
END
$test$;