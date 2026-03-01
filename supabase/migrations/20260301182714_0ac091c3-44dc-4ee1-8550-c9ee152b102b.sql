
-- ============================================================
-- 1. System Admins — platform-level superadmins (seeded manually)
-- ============================================================
CREATE TABLE public.system_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

-- Helper: check if a user is a system admin
CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_admins WHERE user_id = p_user_id
  );
$$;

-- Only system admins can view system_admins table
CREATE POLICY "System admins can view"
  ON public.system_admins FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- ============================================================
-- 2. Role Definitions — custom roles per tenant
-- ============================================================
CREATE TABLE public.role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  display_name text NOT NULL,
  hierarchy_level int NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique role key per tenant
CREATE UNIQUE INDEX idx_role_definitions_tenant_key ON public.role_definitions(tenant_id, role_key);

ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

-- Owners/admins can manage role definitions
CREATE POLICY "Owners can manage role definitions"
  ON public.role_definitions FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner') OR is_system_admin(auth.uid()))
  );

-- All tenant members can view roles
CREATE POLICY "Tenant members can view role definitions"
  ON public.role_definitions FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- System admins can view all
CREATE POLICY "System admins can view all role definitions"
  ON public.role_definitions FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- ============================================================
-- 3. Role Permissions — maps role_key to permission strings
-- ============================================================
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique permission per role per tenant
CREATE UNIQUE INDEX idx_role_permissions_unique ON public.role_permissions(tenant_id, role_key, permission);
CREATE INDEX idx_role_permissions_lookup ON public.role_permissions(tenant_id, role_key);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Owners can manage permissions
CREATE POLICY "Owners can manage role permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner') OR is_system_admin(auth.uid()))
  );

-- Tenant members can view
CREATE POLICY "Tenant members can view role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- System admins can view all
CREATE POLICY "System admins can view all role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- ============================================================
-- 4. Helper: check if current user has a specific permission
--    Owner always has all permissions (hierarchy_level = 0).
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    -- System admins have all permissions
    is_system_admin(p_user_id)
    OR
    -- Owners always have all permissions
    has_tenant_role(p_user_id, 'owner')
    OR
    -- Check explicit permission grant
    EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      JOIN public.role_permissions rp
        ON rp.tenant_id = tu.tenant_id
        AND rp.role_key = tu.role::text
      WHERE tu.user_id = p_user_id
        AND rp.permission = p_permission
    );
$$;
