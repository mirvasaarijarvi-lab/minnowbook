-- Revert the anon SELECT policies that were added on the base tables in the
-- previous migration; they exposed PII columns to anon and broke dedicated
-- regression tests in src/test/security/tenant-scoped-anon-vs-auth.test.ts.
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;
DROP POLICY IF EXISTS "Public can view tenant settings for active tenants" ON public.tenant_settings;
DROP POLICY IF EXISTS "Public can view site settings for active tenants" ON public.site_settings;

-- Recreate the *_public views with security_invoker = off so they bypass RLS
-- on the base tables (the views already filter to safe columns and exclude
-- contact PII). Anon role retains SELECT only on the views, never on the
-- underlying tables. Must drop first because security_invoker is set at
-- creation time and CREATE OR REPLACE can't change it.
DROP VIEW IF EXISTS public.tenants_public;
CREATE VIEW public.tenants_public
WITH (security_invoker = off) AS
  SELECT id, name, slug, is_active, allowed_reservation_types
  FROM public.tenants
  WHERE is_active = true;

DROP VIEW IF EXISTS public.tenant_settings_public;
CREATE VIEW public.tenant_settings_public
WITH (security_invoker = off) AS
  SELECT ts.id, ts.tenant_id, ts.business_name, ts.business_description,
         ts.primary_color, ts.secondary_color, ts.accent_color,
         ts.logo_url, ts.hero_image_url, ts.default_language, ts.timezone,
         ts.resource_type_names, ts.resource_type_descriptions,
         ts.created_at, ts.updated_at
  FROM public.tenant_settings ts
  JOIN public.tenants t ON t.id = ts.tenant_id
  WHERE t.is_active = true;

DROP VIEW IF EXISTS public.site_settings_public;
CREATE VIEW public.site_settings_public
WITH (security_invoker = off) AS
  SELECT ss.id, ss.site_id, ss.tenant_id, ss.business_name, ss.business_description,
         ss.primary_color, ss.secondary_color, ss.accent_color,
         ss.logo_url, ss.hero_image_url,
         ss.created_at, ss.updated_at
  FROM public.site_settings ss
  JOIN public.tenants t ON t.id = ss.tenant_id
  WHERE t.is_active = true;

GRANT SELECT ON public.tenants_public TO anon, authenticated;
GRANT SELECT ON public.tenant_settings_public TO anon, authenticated;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;