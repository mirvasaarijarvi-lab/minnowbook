-- System admins can view ALL tenants (including inactive)
CREATE POLICY "System admins can view all tenants"
  ON public.tenants
  FOR SELECT
  USING (is_system_admin(auth.uid()));

-- System admins can update any tenant
CREATE POLICY "System admins can update all tenants"
  ON public.tenants
  FOR UPDATE
  USING (is_system_admin(auth.uid()));

-- System admins can view all tenant_users
CREATE POLICY "System admins can view all tenant users"
  ON public.tenant_users
  FOR SELECT
  USING (is_system_admin(auth.uid()));

-- System admins can view all tenant_settings
CREATE POLICY "System admins can view all tenant settings"
  ON public.tenant_settings
  FOR SELECT
  USING (is_system_admin(auth.uid()));
