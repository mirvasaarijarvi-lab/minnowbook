-- Restore anon-readable RLS on tenants/tenant_settings/site_settings.
-- The *_public views are SECURITY INVOKER, so dropping these in
-- 20260311065617 left anon with zero visibility and broke /book/:slug.

CREATE POLICY "Public can view active tenants"
  ON public.tenants FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Public can view tenant settings for active tenants"
  ON public.tenant_settings FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_settings.tenant_id AND t.is_active = true
  ));

CREATE POLICY "Public can view site settings for active tenants"
  ON public.site_settings FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = site_settings.tenant_id AND t.is_active = true
  ));