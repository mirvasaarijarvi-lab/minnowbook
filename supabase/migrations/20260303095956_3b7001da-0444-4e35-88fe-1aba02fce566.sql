
-- Add sites.approve permission to admin role for all existing tenants
INSERT INTO role_permissions (tenant_id, role_key, permission)
SELECT id, 'admin', 'sites.approve'
FROM tenants
ON CONFLICT (tenant_id, role_key, permission) DO NOTHING;

-- Update seed function to include sites.approve for admin
CREATE OR REPLACE FUNCTION public.seed_tenant_roles_and_permissions(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.role_definitions (tenant_id, role_key, display_name, hierarchy_level, is_system)
  VALUES
    (p_tenant_id, 'owner', 'Owner', 0, true),
    (p_tenant_id, 'admin', 'Admin', 10, true),
    (p_tenant_id, 'staff', 'Staff', 20, true)
  ON CONFLICT (tenant_id, role_key) DO NOTHING;

  INSERT INTO public.role_permissions (tenant_id, role_key, permission)
  VALUES
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
    (p_tenant_id, 'admin', 'sites.approve'),
    (p_tenant_id, 'staff', 'reservations.view'),
    (p_tenant_id, 'staff', 'reservations.create'),
    (p_tenant_id, 'staff', 'reservations.edit'),
    (p_tenant_id, 'staff', 'resources.view'),
    (p_tenant_id, 'staff', 'calendar.view'),
    (p_tenant_id, 'staff', 'support.view'),
    (p_tenant_id, 'staff', 'sites.view')
  ON CONFLICT (tenant_id, role_key, permission) DO NOTHING;
END;
$$;
