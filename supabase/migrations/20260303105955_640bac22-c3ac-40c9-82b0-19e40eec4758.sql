
-- Create site_users table for per-site role assignments
CREATE TABLE public.site_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (site_id, user_id)
);

-- Enable RLS
ALTER TABLE public.site_users ENABLE ROW LEVEL SECURITY;

-- Owners/admins can manage site_users within their tenant
CREATE POLICY "Owners/admins can manage site users"
ON public.site_users
FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
);

-- Tenant members can view site_users
CREATE POLICY "Tenant members can view site users"
ON public.site_users
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- System admins can view all
CREATE POLICY "System admins can view all site users"
ON public.site_users
FOR SELECT
USING (is_system_admin(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_site_users_user_id ON public.site_users(user_id);
CREATE INDEX idx_site_users_site_id ON public.site_users(site_id);
CREATE INDEX idx_site_users_tenant_id ON public.site_users(tenant_id);
