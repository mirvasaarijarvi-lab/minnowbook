
CREATE OR REPLACE FUNCTION public.is_custom_role_key_assignable_by_owner(_tenant_id uuid, _custom_role_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _custom_role_key IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.role_definitions rd
      WHERE rd.tenant_id = _tenant_id
        AND rd.role_key = _custom_role_key
        AND rd.hierarchy_level >= 10  -- admin (10) or lower (staff=20, custom>=10); blocks owner(0)/superadmin(-10)
        AND rd.role_key NOT IN ('owner', 'superadmin')
    );
$$;

DROP POLICY IF EXISTS "Owners can add tenant users" ON public.tenant_users;
CREATE POLICY "Owners can add tenant users"
ON public.tenant_users
FOR INSERT
TO authenticated
WITH CHECK (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  AND (user_id <> auth.uid())
  AND (role = ANY (ARRAY['staff'::app_role, 'admin'::app_role]))
  AND public.is_custom_role_key_assignable_by_owner(tenant_id, custom_role_key)
);

DROP POLICY IF EXISTS "Owners can update other tenant users" ON public.tenant_users;
CREATE POLICY "Owners can update other tenant users"
ON public.tenant_users
FOR UPDATE
TO authenticated
USING (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  AND (user_id <> auth.uid())
)
WITH CHECK (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  AND (user_id <> auth.uid())
  AND (role = ANY (ARRAY['staff'::app_role, 'admin'::app_role]))
  AND public.is_custom_role_key_assignable_by_owner(tenant_id, custom_role_key)
);
