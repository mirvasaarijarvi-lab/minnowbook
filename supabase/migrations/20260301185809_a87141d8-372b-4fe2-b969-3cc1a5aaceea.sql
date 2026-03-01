-- Add custom_role_key column for custom roles (null means use the enum role)
ALTER TABLE public.tenant_users
  ADD COLUMN custom_role_key text DEFAULT NULL;

-- Update has_permission to check custom_role_key first, falling back to enum role
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    is_system_admin(p_user_id)
    OR
    has_tenant_role(p_user_id, 'owner')
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
$function$;
