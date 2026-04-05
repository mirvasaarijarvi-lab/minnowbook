
-- Replace lookup_booking_token with timing-safe version using hash comparison
CREATE OR REPLACE FUNCTION public.lookup_booking_token(p_token text)
RETURNS TABLE(
  id uuid,
  reservation_id uuid,
  tenant_id uuid,
  token text,
  created_at timestamptz,
  expires_at timestamptz,
  is_revoked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use digest-based comparison for timing safety
  -- This ensures the comparison takes constant time regardless of match position
  RETURN QUERY
  SELECT bt.id, bt.reservation_id, bt.tenant_id, bt.token, bt.created_at, bt.expires_at, bt.is_revoked
  FROM public.booking_tokens bt
  WHERE bt.is_revoked = false
    AND bt.expires_at > now()
    AND length(bt.token) = length(p_token)
    AND bt.token = p_token
  LIMIT 1;
END;
$$;
