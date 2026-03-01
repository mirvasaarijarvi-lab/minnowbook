
-- ============================================================
-- Auto-seed role definitions and permissions for new tenants
-- ============================================================

-- Function to seed default roles + permissions for a tenant
CREATE OR REPLACE FUNCTION public.seed_tenant_roles_and_permissions(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    -- Staff: limited access
    (p_tenant_id, 'staff', 'reservations.view'),
    (p_tenant_id, 'staff', 'reservations.create'),
    (p_tenant_id, 'staff', 'reservations.edit'),
    (p_tenant_id, 'staff', 'resources.view'),
    (p_tenant_id, 'staff', 'calendar.view'),
    (p_tenant_id, 'staff', 'support.view')
  ON CONFLICT (tenant_id, role_key, permission) DO NOTHING;
END;
$$;

-- Trigger: auto-seed on tenant creation
CREATE OR REPLACE FUNCTION public.trigger_seed_tenant_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.seed_tenant_roles_and_permissions(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenant_created_seed_roles
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_tenant_roles();

-- Seed existing tenants
DO $$
DECLARE
  t_id uuid;
BEGIN
  FOR t_id IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_roles_and_permissions(t_id);
  END LOOP;
END;
$$;
