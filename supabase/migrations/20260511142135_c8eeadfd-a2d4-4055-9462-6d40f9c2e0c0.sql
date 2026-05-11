-- Revert views to security_invoker = on so they don't trip the
-- "Security Definer View" linter ERROR. RLS on the base tables (below)
-- combined with column-level GRANTs gives equivalent protection.
DROP VIEW IF EXISTS public.tenants_public;
CREATE VIEW public.tenants_public
WITH (security_invoker = on) AS
  SELECT id, name, slug, is_active, allowed_reservation_types
  FROM public.tenants
  WHERE is_active = true;

DROP VIEW IF EXISTS public.tenant_settings_public;
CREATE VIEW public.tenant_settings_public
WITH (security_invoker = on) AS
  SELECT id, tenant_id, business_name, business_description,
         primary_color, secondary_color, accent_color,
         logo_url, hero_image_url, default_language, timezone,
         resource_type_names, resource_type_descriptions,
         created_at, updated_at
  FROM public.tenant_settings;

DROP VIEW IF EXISTS public.site_settings_public;
CREATE VIEW public.site_settings_public
WITH (security_invoker = on) AS
  SELECT id, site_id, tenant_id, business_name, business_description,
         primary_color, secondary_color, accent_color,
         logo_url, hero_image_url,
         created_at, updated_at
  FROM public.site_settings;

GRANT SELECT ON public.tenants_public TO anon, authenticated;
GRANT SELECT ON public.tenant_settings_public TO anon, authenticated;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- Re-add anon RLS on base tables, scoped to active tenants only.
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;
CREATE POLICY "Public can view active tenants"
  ON public.tenants FOR SELECT TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can view tenant settings for active tenants" ON public.tenant_settings;
CREATE POLICY "Public can view tenant settings for active tenants"
  ON public.tenant_settings FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_settings.tenant_id AND t.is_active = true
  ));

DROP POLICY IF EXISTS "Public can view site settings for active tenants" ON public.site_settings;
CREATE POLICY "Public can view site settings for active tenants"
  ON public.site_settings FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = site_settings.tenant_id AND t.is_active = true
  ));

-- Column-level lockdown: revoke ALL on the base tables from anon,
-- then re-grant SELECT only on the safe (publicly displayable) columns.
-- This makes `select *` and `select business_email,...` from anon return
-- a permission error, while the *_public views (which only project safe
-- columns) continue to work because they only read those columns.
REVOKE ALL ON public.tenants FROM anon;
GRANT SELECT (id, name, slug, is_active, allowed_reservation_types)
  ON public.tenants TO anon;

REVOKE ALL ON public.tenant_settings FROM anon;
GRANT SELECT (id, tenant_id, business_name, business_description,
              primary_color, secondary_color, accent_color,
              logo_url, hero_image_url, default_language, timezone,
              resource_type_names, resource_type_descriptions,
              created_at, updated_at)
  ON public.tenant_settings TO anon;

REVOKE ALL ON public.site_settings FROM anon;
GRANT SELECT (id, site_id, tenant_id, business_name, business_description,
              primary_color, secondary_color, accent_color,
              logo_url, hero_image_url, created_at, updated_at)
  ON public.site_settings TO anon;