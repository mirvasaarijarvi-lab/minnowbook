CREATE OR REPLACE FUNCTION public.claim_discount_code(
  p_tenant_id uuid,
  p_code text,
  p_reservation_type text
)
RETURNS TABLE(
  id uuid,
  discount_type text,
  discount_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  RETURN QUERY
  UPDATE public.discount_codes dc
  SET used_count = dc.used_count + 1
  WHERE dc.tenant_id = p_tenant_id
    AND dc.code = upper(p_code)
    AND dc.is_active = true
    AND (dc.valid_from IS NULL OR v_today >= dc.valid_from)
    AND (dc.valid_until IS NULL OR v_today <= dc.valid_until)
    AND (dc.max_uses IS NULL OR dc.used_count < dc.max_uses)
    AND (
      dc.applies_to IS NULL
      OR array_length(dc.applies_to, 1) IS NULL
      OR p_reservation_type = ANY(dc.applies_to)
    )
  RETURNING dc.id, dc.discount_type, dc.discount_value;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_discount_code(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_discount_code(uuid, text, text) TO service_role;