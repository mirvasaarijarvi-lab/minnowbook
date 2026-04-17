
-- Tighten review INSERT policy: token must be valid AND belong to the
-- reservation the review is being created for.
DROP POLICY IF EXISTS "Anyone can submit review with valid token" ON public.guest_reviews;

CREATE OR REPLACE FUNCTION public.is_valid_review_token_for_reservation(
  p_token text,
  p_reservation_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.booking_tokens
    WHERE token = p_token
      AND reservation_id = p_reservation_id
      AND tenant_id = p_tenant_id
      AND is_revoked = false
      AND expires_at > now()
  );
$$;

CREATE POLICY "Anyone can submit review with matching token"
  ON public.guest_reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    review_token IS NOT NULL
    AND reservation_id IS NOT NULL
    AND public.is_valid_review_token_for_reservation(
      review_token,
      reservation_id,
      tenant_id
    )
  );
