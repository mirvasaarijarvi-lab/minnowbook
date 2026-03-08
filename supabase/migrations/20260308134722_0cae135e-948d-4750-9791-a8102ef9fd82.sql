
-- 1. Drop existing SECURITY DEFINER views
DROP VIEW IF EXISTS public.tenants_public;
DROP VIEW IF EXISTS public.tenant_settings_public;
DROP VIEW IF EXISTS public.site_settings_public;

-- 2. Recreate views with SECURITY INVOKER
CREATE VIEW public.tenants_public
WITH (security_invoker = true)
AS
SELECT id, name, slug, is_active, allowed_reservation_types
FROM public.tenants
WHERE is_active = true;

CREATE VIEW public.tenant_settings_public
WITH (security_invoker = true)
AS
SELECT id, tenant_id, business_name, business_description,
       primary_color, secondary_color, accent_color,
       logo_url, hero_image_url, default_language, timezone,
       resource_type_names, resource_type_descriptions,
       created_at, updated_at
FROM public.tenant_settings;

CREATE VIEW public.site_settings_public
WITH (security_invoker = true)
AS
SELECT id, site_id, tenant_id, business_name, business_description,
       primary_color, secondary_color, accent_color,
       logo_url, hero_image_url, created_at, updated_at
FROM public.site_settings;

-- 3. Grant SELECT on views to anon and authenticated
GRANT SELECT ON public.tenants_public TO anon, authenticated;
GRANT SELECT ON public.tenant_settings_public TO anon, authenticated;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- 4. Update RLS policies on base tables: replace USING(false) with actual access for anon
-- Tenants: allow anon to SELECT active tenants
DROP POLICY IF EXISTS "Public can view active tenants via view" ON public.tenants;
CREATE POLICY "Public can view active tenants"
  ON public.tenants FOR SELECT TO anon
  USING (is_active = true);

-- Tenant settings: allow anon to SELECT settings for active tenants
DROP POLICY IF EXISTS "Public can view tenant settings via view" ON public.tenant_settings;
CREATE POLICY "Public can view tenant settings for active tenants"
  ON public.tenant_settings FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_settings.tenant_id AND t.is_active = true
  ));

-- Site settings: allow anon to SELECT settings for active tenants
DROP POLICY IF EXISTS "Public can view site settings via view" ON public.site_settings;
CREATE POLICY "Public can view site settings for active tenants"
  ON public.site_settings FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = site_settings.tenant_id AND t.is_active = true
  ));
