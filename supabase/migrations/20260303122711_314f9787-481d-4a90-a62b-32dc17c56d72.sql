
-- ═══ System admin full-access write policies ═══
-- These give system admins unrestricted access without needing a tenant_user row.

-- 1. tenant_settings: fix the broken AND policy → separate system admin ALL policy
DROP POLICY IF EXISTS "Owners/admins can manage tenant settings" ON public.tenant_settings;

CREATE POLICY "Owners/admins can manage tenant settings"
ON public.tenant_settings FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_tenant_role(auth.uid(), 'admin'::public.app_role)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_tenant_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "System admins can manage all tenant settings"
ON public.tenant_settings FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 2. role_definitions: same issue
DROP POLICY IF EXISTS "Owners can manage role definitions" ON public.role_definitions;

CREATE POLICY "Owners can manage role definitions"
ON public.role_definitions FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
);

CREATE POLICY "System admins can manage all role definitions"
ON public.role_definitions FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 3. role_permissions: same issue
DROP POLICY IF EXISTS "Owners can manage role permissions" ON public.role_permissions;

CREATE POLICY "Owners can manage role permissions"
ON public.role_permissions FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
);

CREATE POLICY "System admins can manage all role permissions"
ON public.role_permissions FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 4. sites: system admins need full CRUD
CREATE POLICY "System admins can manage all sites"
ON public.sites FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 5. site_users: system admins need full CRUD
CREATE POLICY "System admins can manage all site users"
ON public.site_users FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 6. reservations: system admins need full CRUD
CREATE POLICY "System admins can manage all reservations"
ON public.reservations FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 7. resources: system admins need full CRUD
CREATE POLICY "System admins can manage all resources"
ON public.resources FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 8. tenant_users: system admins need full CRUD
CREATE POLICY "System admins can manage all tenant users"
ON public.tenant_users FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 9. blocked_slots: system admins need full CRUD
CREATE POLICY "System admins can manage all blocked slots"
ON public.blocked_slots FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 10. recurring_blocked_slots: system admins need full CRUD
CREATE POLICY "System admins can manage all recurring blocked slots"
ON public.recurring_blocked_slots FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 11. tenant_email_templates: system admins need full CRUD
CREATE POLICY "System admins can manage all email templates"
ON public.tenant_email_templates FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 12. tenant_opening_hours: system admins need full CRUD
CREATE POLICY "System admins can manage all opening hours"
ON public.tenant_opening_hours FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 13. support_requests: system admins need full CRUD
CREATE POLICY "System admins can manage all support requests"
ON public.support_requests FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 14. resource_images: system admins need full CRUD
CREATE POLICY "System admins can manage all resource images"
ON public.resource_images FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 15. audit_log: fix the AND-gated SELECT → separate policy
DROP POLICY IF EXISTS "Owners/admins can view audit log" ON public.audit_log;

CREATE POLICY "Owners/admins can view audit log"
ON public.audit_log FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_tenant_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_tenant_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "System admins can view all audit logs"
ON public.audit_log FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- 16. discount_codes: system admins need full CRUD
CREATE POLICY "System admins can manage all discount codes"
ON public.discount_codes FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 17. login_history: system admins need full SELECT
CREATE POLICY "System admins can view all login history"
ON public.login_history FOR SELECT
USING (public.is_system_admin(auth.uid()));
