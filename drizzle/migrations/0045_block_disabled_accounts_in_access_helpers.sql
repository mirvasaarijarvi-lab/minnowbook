CREATE OR REPLACE FUNCTION public.is_account_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id
      AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until <= now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_account_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_user_tenant_member(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_account_active(p_user_id) AND EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND is_approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(p_user_id uuid, p_role app_role, p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_account_active(p_user_id) AND EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = p_user_id AND role = p_role AND tenant_id = p_tenant_id AND is_approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_account_active(p_user_id) AND EXISTS (
    SELECT 1 FROM public.system_admins WHERE user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text, p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_account_active(p_user_id) AND (
    is_system_admin(p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = p_user_id AND tenant_id = p_tenant_id
        AND (role = 'owner' OR role = 'superadmin')
    )
    OR EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.role_permissions rp
        ON rp.tenant_id = tu.tenant_id
       AND rp.role_key = COALESCE(tu.custom_role_key, tu.role::text)
      WHERE tu.user_id = p_user_id AND tu.tenant_id = p_tenant_id
        AND rp.permission = p_permission
    )
  );
$$;