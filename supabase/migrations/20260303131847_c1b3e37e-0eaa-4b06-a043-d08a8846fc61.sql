
-- Update seed function to include superadmin with ALL permissions
CREATE OR REPLACE FUNCTION public.seed_tenant_roles_and_permissions(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.role_definitions (tenant_id, role_key, display_name, hierarchy_level, is_system)
  VALUES
    (p_tenant_id, 'superadmin', 'Superadmin', -10, true),
    (p_tenant_id, 'owner', 'Owner', 0, true),
    (p_tenant_id, 'admin', 'Admin', 10, true),
    (p_tenant_id, 'staff', 'Staff', 20, true)
  ON CONFLICT (tenant_id, role_key) DO NOTHING;

  INSERT INTO public.role_permissions (tenant_id, role_key, permission)
  VALUES
    (p_tenant_id, 'superadmin', 'reservations.view'),
    (p_tenant_id, 'superadmin', 'reservations.create'),
    (p_tenant_id, 'superadmin', 'reservations.edit'),
    (p_tenant_id, 'superadmin', 'reservations.delete'),
    (p_tenant_id, 'superadmin', 'resources.view'),
    (p_tenant_id, 'superadmin', 'resources.manage'),
    (p_tenant_id, 'superadmin', 'reports.view'),
    (p_tenant_id, 'superadmin', 'settings.view'),
    (p_tenant_id, 'superadmin', 'settings.manage'),
    (p_tenant_id, 'superadmin', 'support.view'),
    (p_tenant_id, 'superadmin', 'support.manage'),
    (p_tenant_id, 'superadmin', 'calendar.view'),
    (p_tenant_id, 'superadmin', 'admin.view'),
    (p_tenant_id, 'superadmin', 'admin.manage'),
    (p_tenant_id, 'superadmin', 'sites.view'),
    (p_tenant_id, 'superadmin', 'sites.manage'),
    (p_tenant_id, 'superadmin', 'sites.approve'),
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

-- Update has_permission to also bypass for superadmin
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    is_system_admin(p_user_id)
    OR
    has_tenant_role(p_user_id, 'owner')
    OR
    has_tenant_role(p_user_id, 'superadmin')
    OR
    EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      JOIN public.role_permissions rp
        ON rp.tenant_id = tu.tenant_id
        AND rp.role_key = COALESCE(tu.custom_role_key, tu.role::text)
      WHERE tu.user_id = p_user_id
        AND rp.permission = p_permission
    );
$$;

-- Seed superadmin role definition into existing tenants
INSERT INTO public.role_definitions (tenant_id, role_key, display_name, hierarchy_level, is_system)
SELECT id, 'superadmin', 'Superadmin', -10, true
FROM public.tenants
ON CONFLICT (tenant_id, role_key) DO NOTHING;

-- Seed superadmin permissions into existing tenants
INSERT INTO public.role_permissions (tenant_id, role_key, permission)
SELECT t.id, 'superadmin', p.perm
FROM public.tenants t
CROSS JOIN (
  VALUES 
    ('reservations.view'), ('reservations.create'), ('reservations.edit'), ('reservations.delete'),
    ('resources.view'), ('resources.manage'), ('reports.view'), ('settings.view'), ('settings.manage'),
    ('support.view'), ('support.manage'), ('calendar.view'), ('admin.view'), ('admin.manage'),
    ('sites.view'), ('sites.manage'), ('sites.approve')
) AS p(perm)
ON CONFLICT (tenant_id, role_key, permission) DO NOTHING;
