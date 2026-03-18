
-- Fix: site_settings SELECT policy role from public to authenticated
DROP POLICY IF EXISTS "Tenant members can view site settings" ON public.site_settings;
CREATE POLICY "Tenant members can view site settings"
  ON public.site_settings FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Fix: discount_codes SELECT policy role from public to authenticated
DROP POLICY IF EXISTS "Staff can view discount codes" ON public.discount_codes;
CREATE POLICY "Staff can view discount codes"
  ON public.discount_codes FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Fix: notifications SELECT and UPDATE policies from public to authenticated
DROP POLICY IF EXISTS "Tenant members can view notifications" ON public.notifications;
CREATE POLICY "Tenant members can view notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant members can update notifications" ON public.notifications;
CREATE POLICY "Tenant members can update notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Fix: site_users SELECT policy from public to authenticated
DROP POLICY IF EXISTS "Tenant members can view site users" ON public.site_users;
CREATE POLICY "Tenant members can view site users"
  ON public.site_users FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
