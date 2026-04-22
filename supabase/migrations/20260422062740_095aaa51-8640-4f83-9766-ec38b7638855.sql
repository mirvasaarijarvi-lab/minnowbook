-- Add tenant-scoped SELECT policy on email_send_log so tenant owners/admins
-- can view their own email delivery records (recipient emails isolated per tenant).
-- The existing RESTRICTIVE policy "Block authenticated users from email_send_log"
-- already gates all access through is_system_admin OR matching permissive policies;
-- we add a permissive policy for tenant owners/admins scoped to their tenant_id.

-- Permissive SELECT: tenant owners/admins can view their tenant's email logs
DROP POLICY IF EXISTS "Tenant owners/admins can view own email logs" ON public.email_send_log;
CREATE POLICY "Tenant owners/admins can view own email logs"
  ON public.email_send_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
      OR public.has_tenant_role(auth.uid(), 'admin'::public.app_role, tenant_id)
    )
  );

-- Relax the RESTRICTIVE block so tenant owners/admins reading their own rows
-- aren't blocked. Restrictive policy now permits: system admins OR a row owned
-- by the caller's tenant where they hold owner/admin. All other access stays denied.
DROP POLICY IF EXISTS "Block authenticated users from email_send_log" ON public.email_send_log;
CREATE POLICY "Restrict authenticated access to email_send_log"
  ON public.email_send_log
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR (
      tenant_id IS NOT NULL
      AND tenant_id = public.get_user_tenant_id(auth.uid())
      AND (
        public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
        OR public.has_tenant_role(auth.uid(), 'admin'::public.app_role, tenant_id)
      )
    )
  )
  WITH CHECK (
    public.is_system_admin(auth.uid())
  );