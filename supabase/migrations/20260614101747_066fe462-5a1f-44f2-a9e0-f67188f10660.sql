
CREATE OR REPLACE FUNCTION public.claim_access_code(
  p_access_code_id uuid,
  p_tenant_id uuid,
  p_user_id uuid,
  p_granted_tier text,
  p_granted_until date,
  p_duration_days integer
)
RETURNS TABLE(success boolean, reason text, redemption_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.access_codes%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_redemption_id uuid;
BEGIN
  -- Lock the access code row to serialize concurrent redemptions
  SELECT * INTO v_code
  FROM public.access_codes
  WHERE id = p_access_code_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found'::text, NULL::uuid;
    RETURN;
  END IF;

  IF NOT v_code.is_active OR v_code.is_revoked THEN
    RETURN QUERY SELECT false, 'inactive'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_code.valid_from IS NOT NULL AND v_code.valid_from > v_today THEN
    RETURN QUERY SELECT false, 'not_yet_valid'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_code.valid_until IS NOT NULL AND v_code.valid_until < v_today THEN
    RETURN QUERY SELECT false, 'expired'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
    RETURN QUERY SELECT false, 'exhausted'::text, NULL::uuid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.access_code_redemptions
    WHERE access_code_id = p_access_code_id
      AND tenant_id = p_tenant_id
  ) THEN
    RETURN QUERY SELECT false, 'already_redeemed'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.access_code_redemptions (
    access_code_id, tenant_id, redeemed_by, granted_tier, granted_until
  ) VALUES (
    p_access_code_id, p_tenant_id, p_user_id, p_granted_tier, p_granted_until
  )
  RETURNING id INTO v_redemption_id;

  UPDATE public.access_codes
  SET used_count = used_count + 1,
      updated_at = now()
  WHERE id = p_access_code_id;

  UPDATE public.tenants
  SET tier = p_granted_tier,
      sample_start_date = v_today,
      sample_end_date = p_granted_until,
      subscription_status = 'trialing'
  WHERE id = p_tenant_id;

  RETURN QUERY SELECT true, 'ok'::text, v_redemption_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_access_code(uuid, uuid, uuid, text, date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_access_code(uuid, uuid, uuid, text, date, integer) TO service_role;
