-- Allow owners, admins, and system admins to manage tenant settings
DROP POLICY IF EXISTS "Owners can manage tenant settings" ON public.tenant_settings;

CREATE POLICY "Owners/admins can manage tenant settings"
ON public.tenant_settings
FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_tenant_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_system_admin(auth.uid())
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_tenant_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_system_admin(auth.uid())
  )
);