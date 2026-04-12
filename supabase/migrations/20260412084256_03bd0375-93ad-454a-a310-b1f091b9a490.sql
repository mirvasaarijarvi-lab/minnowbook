-- 1. Drop the broad tenant member SELECT policy
DROP POLICY IF EXISTS "Tenant members can view own tenant" ON public.tenants;

-- 2. Add owner/admin-only SELECT policy for direct table access
CREATE POLICY "Owners/admins can view own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  (id = get_user_tenant_id(auth.uid()))
  AND (
    has_tenant_role(auth.uid(), 'owner'::app_role, id)
    OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
  )
);

-- 3. Recreate tenants_safe as SECURITY DEFINER view with built-in access checks
DROP VIEW IF EXISTS public.tenants_safe;

CREATE VIEW public.tenants_safe AS
SELECT
  id, name, slug, owner_user_id, subscription_status, tier,
  allowed_reservation_types, max_staff_users, is_active,
  created_at, updated_at, sample_start_date, sample_end_date,
  discount_percentage, discount_reason, discount_granted_by,
  CASE
    WHEN has_tenant_role(auth.uid(), 'owner'::app_role, id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
      OR is_system_admin(auth.uid())
    THEN stripe_customer_id
    ELSE NULL
  END AS stripe_customer_id,
  CASE
    WHEN has_tenant_role(auth.uid(), 'owner'::app_role, id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
      OR is_system_admin(auth.uid())
    THEN stripe_subscription_id
    ELSE NULL
  END AS stripe_subscription_id
FROM public.tenants
WHERE
  id = get_user_tenant_id(auth.uid())
  OR is_system_admin(auth.uid());

-- 4. Grant SELECT on the view to authenticated and anon roles
GRANT SELECT ON public.tenants_safe TO authenticated;
GRANT SELECT ON public.tenants_safe TO anon;