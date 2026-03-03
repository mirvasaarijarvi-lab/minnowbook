
-- =============================================
-- MULTI-SITE PHASE 1: Sites table + site_id columns + approval workflow
-- =============================================

-- 1. Create sites table
CREATE TABLE public.sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  location text,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- RLS policies for sites
CREATE POLICY "Tenant members can view their sites"
  ON public.sites FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "System admins can view all sites"
  ON public.sites FOR SELECT TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Public can view active sites for booking"
  ON public.sites FOR SELECT
  USING (is_active = true);

CREATE POLICY "Owners/admins can manage sites"
  ON public.sites FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
  );

-- 2. Add site_id to existing tables (nullable for backward compat)
ALTER TABLE public.resources ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.reservations ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.blocked_slots ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.recurring_blocked_slots ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.tenant_opening_hours ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.tenant_email_templates ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

-- Indexes for site_id lookups
CREATE INDEX idx_resources_site_id ON public.resources(site_id);
CREATE INDEX idx_reservations_site_id ON public.reservations(site_id);
CREATE INDEX idx_blocked_slots_site_id ON public.blocked_slots(site_id);
CREATE INDEX idx_recurring_blocked_slots_site_id ON public.recurring_blocked_slots(site_id);
CREATE INDEX idx_opening_hours_site_id ON public.tenant_opening_hours(site_id);
CREATE INDEX idx_email_templates_site_id ON public.tenant_email_templates(site_id);

-- 3. Add approval workflow columns to relevant tables
-- For opening hours
ALTER TABLE public.tenant_opening_hours 
  ADD COLUMN approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN approved_by uuid,
  ADD COLUMN rejection_reason text;

-- For blocked slots
ALTER TABLE public.blocked_slots
  ADD COLUMN approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN approved_by uuid,
  ADD COLUMN rejection_reason text;

-- For recurring blocked slots
ALTER TABLE public.recurring_blocked_slots
  ADD COLUMN approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN approved_by uuid,
  ADD COLUMN rejection_reason text;

-- For email templates
ALTER TABLE public.tenant_email_templates
  ADD COLUMN approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN approved_by uuid,
  ADD COLUMN rejection_reason text;

-- For resources
ALTER TABLE public.resources
  ADD COLUMN approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN approved_by uuid,
  ADD COLUMN rejection_reason text;

-- 4. Add sites permissions to seed function
CREATE OR REPLACE FUNCTION public.seed_tenant_roles_and_permissions(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert system role definitions
  INSERT INTO public.role_definitions (tenant_id, role_key, display_name, hierarchy_level, is_system)
  VALUES
    (p_tenant_id, 'owner', 'Owner', 0, true),
    (p_tenant_id, 'admin', 'Admin', 10, true),
    (p_tenant_id, 'staff', 'Staff', 20, true)
  ON CONFLICT (tenant_id, role_key) DO NOTHING;

  -- Admin permissions (owner gets everything automatically via has_permission function)
  INSERT INTO public.role_permissions (tenant_id, role_key, permission)
  VALUES
    -- Admin: full access except admin.manage
    (p_tenant_id, 'admin', 'reservations.view'),
    (p_tenant_id, 'admin', 'reservations.create'),
    (p_tenant_id, 'admin', 'reservations.edit'),
    (p_tenant_id, 'admin', 'reservations.delete'),
    (p_tenant_id, 'admin', 'resources.view'),
    (p_tenant_id, 'admin', 'resources.manage'),
    (p_tenant_id, 'admin', 'reports.view'),
    (p_tenant_id, 'admin', 'settings.view'),
    (p_tenant_id, 'admin', 'support.view'),
    (p_tenant_id, 'admin', 'support.manage'),
    (p_tenant_id, 'admin', 'calendar.view'),
    (p_tenant_id, 'admin', 'admin.view'),
    (p_tenant_id, 'admin', 'sites.view'),
    (p_tenant_id, 'admin', 'sites.manage'),
    -- Staff: limited access
    (p_tenant_id, 'staff', 'reservations.view'),
    (p_tenant_id, 'staff', 'reservations.create'),
    (p_tenant_id, 'staff', 'reservations.edit'),
    (p_tenant_id, 'staff', 'resources.view'),
    (p_tenant_id, 'staff', 'calendar.view'),
    (p_tenant_id, 'staff', 'support.view'),
    (p_tenant_id, 'staff', 'sites.view')
  ON CONFLICT (tenant_id, role_key, permission) DO NOTHING;
END;
$function$;

-- 5. Add audit log trigger on sites table
CREATE TRIGGER audit_sites
  AFTER INSERT OR UPDATE OR DELETE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
