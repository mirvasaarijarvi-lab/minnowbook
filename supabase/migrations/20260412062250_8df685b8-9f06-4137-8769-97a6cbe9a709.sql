
-- 1. Fix: Restrict Stripe IDs on tenants table to owners/admins only
-- Drop the permissive "all members can view" policy
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;

-- Owners/admins can see full row (including stripe IDs)
CREATE POLICY "Owners/admins can view full tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = get_user_tenant_id(auth.uid())
  AND (
    has_tenant_role(auth.uid(), 'owner'::app_role, id)
    OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
  )
);

-- Staff can view tenant but only non-sensitive columns via tenants_safe view
-- For base table: staff still need SELECT for RLS FK checks, but we restrict to minimal access
CREATE POLICY "Staff can view own tenant basic info"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = get_user_tenant_id(auth.uid())
);

-- NOTE: The above still allows staff to SELECT stripe columns from base table.
-- True column-level restriction requires the tenants_safe view approach.
-- Let's instead remove the broad policy and force staff through the view:
DROP POLICY IF EXISTS "Staff can view own tenant basic info" ON public.tenants;

-- Create a SECURITY DEFINER function to check tenant membership without needing SELECT on tenants
CREATE OR REPLACE FUNCTION public.is_user_tenant_member(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  );
$$;

-- Only owners/admins/system admins can read base tenants table
CREATE POLICY "Owners admins can view own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = get_user_tenant_id(auth.uid())
  AND (
    has_tenant_role(auth.uid(), 'owner'::app_role, id)
    OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
    OR is_system_admin(auth.uid())
  )
);

-- 2. Fix: Validate review_token in guest_reviews INSERT policy
-- Create a validation function
CREATE OR REPLACE FUNCTION public.is_valid_review_token(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_tokens
    WHERE token = p_token
      AND is_revoked = false
      AND expires_at > now()
  );
$$;

-- Drop the old permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can submit review with token" ON public.guest_reviews;

-- Create a new policy that validates the token
CREATE POLICY "Anyone can submit review with valid token"
ON public.guest_reviews
FOR INSERT
TO public
WITH CHECK (
  review_token IS NOT NULL
  AND public.is_valid_review_token(review_token)
);
