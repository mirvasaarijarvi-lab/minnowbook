
-- Fix views: remove security_invoker=on so views bypass base table RLS
-- Add WHERE filters directly in the views for safety

-- tenants_public: only active tenants, safe columns only
CREATE OR REPLACE VIEW public.tenants_public AS
  SELECT id, name, slug, is_active, allowed_reservation_types
  FROM public.tenants
  WHERE is_active = true;

-- tenant_settings_public: exclude contact details and internal config
CREATE OR REPLACE VIEW public.tenant_settings_public AS
  SELECT id, tenant_id, business_name, business_description,
         primary_color, secondary_color, accent_color,
         logo_url, hero_image_url, default_language, timezone,
         resource_type_names, resource_type_descriptions,
         created_at, updated_at
  FROM public.tenant_settings;

-- site_settings_public: exclude contact details
CREATE OR REPLACE VIEW public.site_settings_public AS
  SELECT id, site_id, tenant_id, business_name, business_description,
         primary_color, secondary_color, accent_color,
         logo_url, hero_image_url,
         created_at, updated_at
  FROM public.site_settings;

-- Re-grant access
GRANT SELECT ON public.tenants_public TO anon;
GRANT SELECT ON public.tenants_public TO authenticated;
GRANT SELECT ON public.tenant_settings_public TO anon;
GRANT SELECT ON public.tenant_settings_public TO authenticated;
GRANT SELECT ON public.site_settings_public TO anon;
GRANT SELECT ON public.site_settings_public TO authenticated;
