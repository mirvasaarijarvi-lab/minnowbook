
-- ============================================================
-- FIX 1: Scoped has_tenant_role (3-param overload)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_tenant_role(p_user_id uuid, p_role app_role, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = p_user_id AND role = p_role AND tenant_id = p_tenant_id
  );
$$;

-- ============================================================
-- FIX 2: Create public views with safe columns only
-- ============================================================

-- tenants_public: only safe columns for booking
CREATE OR REPLACE VIEW public.tenants_public
WITH (security_invoker = on) AS
  SELECT id, name, slug, is_active, allowed_reservation_types
  FROM public.tenants;

-- tenant_settings_public: exclude contact details and internal config
CREATE OR REPLACE VIEW public.tenant_settings_public
WITH (security_invoker = on) AS
  SELECT id, tenant_id, business_name, business_description,
         primary_color, secondary_color, accent_color,
         logo_url, hero_image_url, default_language, timezone,
         resource_type_names, resource_type_descriptions,
         created_at, updated_at
  FROM public.tenant_settings;

-- site_settings_public: exclude contact details
CREATE OR REPLACE VIEW public.site_settings_public
WITH (security_invoker = on) AS
  SELECT id, site_id, tenant_id, business_name, business_description,
         primary_color, secondary_color, accent_color,
         logo_url, hero_image_url,
         created_at, updated_at
  FROM public.site_settings;

-- ============================================================
-- FIX 3: Replace public SELECT policies on base tables
-- ============================================================

-- tenants: replace unrestricted public policy with one that denies anon direct access
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;
CREATE POLICY "Public can view active tenants via view"
  ON public.tenants FOR SELECT TO anon
  USING (false);

-- Grant anon SELECT on the public view
GRANT SELECT ON public.tenants_public TO anon;
GRANT SELECT ON public.tenants_public TO authenticated;

-- tenant_settings: replace unrestricted public policy
DROP POLICY IF EXISTS "Public can view tenant settings for booking" ON public.tenant_settings;
CREATE POLICY "Public can view tenant settings via view"
  ON public.tenant_settings FOR SELECT TO anon
  USING (false);

GRANT SELECT ON public.tenant_settings_public TO anon;
GRANT SELECT ON public.tenant_settings_public TO authenticated;

-- site_settings: replace unrestricted public policy
DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
CREATE POLICY "Public can view site settings via view"
  ON public.site_settings FOR SELECT TO anon
  USING (false);

GRANT SELECT ON public.site_settings_public TO anon;
GRANT SELECT ON public.site_settings_public TO authenticated;

-- ============================================================
-- FIX 4: Update ALL RLS policies to use scoped has_tenant_role
-- ============================================================

-- audit_log
DROP POLICY IF EXISTS "Owners/admins can view audit log" ON public.audit_log;
CREATE POLICY "Owners/admins can view audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- blocked_slots
DROP POLICY IF EXISTS "Owners/admins can manage blocked slots" ON public.blocked_slots;
CREATE POLICY "Owners/admins can manage blocked slots"
  ON public.blocked_slots FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- discount_codes
DROP POLICY IF EXISTS "Owners/admins can manage discount codes" ON public.discount_codes;
CREATE POLICY "Owners/admins can manage discount codes"
  ON public.discount_codes FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- recurring_blocked_slots
DROP POLICY IF EXISTS "Owners/admins can manage recurring blocked slots" ON public.recurring_blocked_slots;
CREATE POLICY "Owners/admins can manage recurring blocked slots"
  ON public.recurring_blocked_slots FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- resource_images
DROP POLICY IF EXISTS "Owners/admins can manage resource images" ON public.resource_images;
CREATE POLICY "Owners/admins can manage resource images"
  ON public.resource_images FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- resource_opening_hours
DROP POLICY IF EXISTS "Owners/admins can manage resource opening hours" ON public.resource_opening_hours;
CREATE POLICY "Owners/admins can manage resource opening hours"
  ON public.resource_opening_hours FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- resources
DROP POLICY IF EXISTS "Owners/admins can manage resources" ON public.resources;
CREATE POLICY "Owners/admins can manage resources"
  ON public.resources FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- role_definitions
DROP POLICY IF EXISTS "Owners can manage role definitions" ON public.role_definitions;
CREATE POLICY "Owners can manage role definitions"
  ON public.role_definitions FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  );

-- role_permissions
DROP POLICY IF EXISTS "Owners can manage role permissions" ON public.role_permissions;
CREATE POLICY "Owners can manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  );

-- site_settings
DROP POLICY IF EXISTS "Owners/admins can manage site settings" ON public.site_settings;
CREATE POLICY "Owners/admins can manage site settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- site_users
DROP POLICY IF EXISTS "Owners/admins can manage site users" ON public.site_users;
CREATE POLICY "Owners/admins can manage site users"
  ON public.site_users FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- sites
DROP POLICY IF EXISTS "Owners/admins can manage sites" ON public.sites;
CREATE POLICY "Owners/admins can manage sites"
  ON public.sites FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- support_requests
DROP POLICY IF EXISTS "Owners/admins can manage support requests" ON public.support_requests;
CREATE POLICY "Owners/admins can manage support requests"
  ON public.support_requests FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- tenant_email_templates
DROP POLICY IF EXISTS "Owners can manage email templates" ON public.tenant_email_templates;
CREATE POLICY "Owners can manage email templates"
  ON public.tenant_email_templates FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  );

-- tenant_opening_hours
DROP POLICY IF EXISTS "Owners/admins can manage opening hours" ON public.tenant_opening_hours;
CREATE POLICY "Owners/admins can manage opening hours"
  ON public.tenant_opening_hours FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- tenant_settings
DROP POLICY IF EXISTS "Owners/admins can manage tenant settings" ON public.tenant_settings;
CREATE POLICY "Owners/admins can manage tenant settings"
  ON public.tenant_settings FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );

-- tenant_users
DROP POLICY IF EXISTS "Owners can manage tenant users" ON public.tenant_users;
CREATE POLICY "Owners can manage tenant users"
  ON public.tenant_users FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  );

-- tenants (uses 'id' as its own tenant_id)
DROP POLICY IF EXISTS "Owners can update their tenant" ON public.tenants;
CREATE POLICY "Owners can update their tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (
    id = get_user_tenant_id(auth.uid())
    AND has_tenant_role(auth.uid(), 'owner'::app_role, id)
  );

-- ============================================================
-- Also update has_permission to use scoped check
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_system_admin(p_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = p_user_id
        AND (role = 'owner' OR role = 'superadmin')
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      JOIN public.role_permissions rp
        ON rp.tenant_id = tu.tenant_id
        AND rp.role_key = COALESCE(tu.custom_role_key, tu.role::text)
      WHERE tu.user_id = p_user_id
        AND rp.permission = p_permission
    );
$$;
