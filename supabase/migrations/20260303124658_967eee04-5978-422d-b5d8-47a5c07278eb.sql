-- Per-site settings overrides (NULL = inherit from tenant_settings)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Business details overrides
  business_name text,
  business_email text,
  business_phone text,
  business_address text,
  business_description text,
  -- Branding overrides
  primary_color text,
  secondary_color text,
  accent_color text,
  logo_url text,
  hero_image_url text,
  -- Meta
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Owners/admins can manage
CREATE POLICY "Owners/admins can manage site settings"
ON public.site_settings FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
);

-- All tenant members can view
CREATE POLICY "Tenant members can view site settings"
ON public.site_settings FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Public can view for booking pages
CREATE POLICY "Public can view site settings"
ON public.site_settings FOR SELECT
USING (true);

-- System admins full access
CREATE POLICY "System admins can manage all site settings"
ON public.site_settings FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));