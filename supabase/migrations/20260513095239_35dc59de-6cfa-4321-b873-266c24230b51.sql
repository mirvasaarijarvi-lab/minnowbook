-- 1) Revoke anon access to sensitive tenant columns (public booking only needs safe columns)
REVOKE SELECT (
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  tier,
  owner_user_id,
  discount_percentage,
  discount_reason,
  discount_granted_by,
  sample_start_date,
  sample_end_date
) ON public.tenants FROM anon;

-- 2) Tighten guest_reviews INSERT: require guest_email matches the reservation
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
    SELECT 1 FROM public.reservations r
    WHERE r.id = guest_reviews.reservation_id
      AND r.tenant_id = guest_reviews.tenant_id
      AND lower(trim(r.guest_email)) = lower(trim(guest_reviews.guest_email))
  )
);

-- 3) has_tenant_role must require approved membership
CREATE OR REPLACE FUNCTION public.has_tenant_role(p_user_id uuid, p_role app_role, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = p_user_id
      AND role = p_role
      AND tenant_id = p_tenant_id
      AND is_approved = true
  );
$$;