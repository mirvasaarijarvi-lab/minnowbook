DROP POLICY IF EXISTS "Anyone can submit review with matching token" ON public.guest_reviews;

CREATE POLICY "Anyone can submit review with matching token"
ON public.guest_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  review_token IS NOT NULL
  AND reservation_id IS NOT NULL
  AND public.is_valid_review_token_for_reservation(review_token, reservation_id, tenant_id)
  AND EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.id = guest_reviews.reservation_id
      AND r.tenant_id = guest_reviews.tenant_id
      AND lower(trim(r.guest_email)) = lower(trim(guest_reviews.guest_email))
      AND lower(trim(r.guest_name)) = lower(trim(guest_reviews.guest_name))
  )
);