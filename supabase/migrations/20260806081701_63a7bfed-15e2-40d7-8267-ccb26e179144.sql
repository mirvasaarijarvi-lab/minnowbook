DROP POLICY IF EXISTS "Owners/admins can manage discount codes" ON public.discount_codes;

CREATE POLICY "Owners/admins can manage discount codes"
ON public.discount_codes
FOR ALL
TO authenticated
USING (
  public.is_user_tenant_member(auth.uid(), tenant_id)
  AND (
    public.has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    OR public.has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    OR public.has_tenant_role(auth.uid(), 'superadmin'::app_role, tenant_id)
  )
)
WITH CHECK (
  public.is_user_tenant_member(auth.uid(), tenant_id)
  AND (
    public.has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    OR public.has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    OR public.has_tenant_role(auth.uid(), 'superadmin'::app_role, tenant_id)
  )
);