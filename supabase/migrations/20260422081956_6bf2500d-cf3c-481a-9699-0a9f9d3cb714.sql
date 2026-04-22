-- 1. Harden get_user_tenant_id: return NULL if user belongs to >1 tenant.
-- Fail-closed: RLS policies comparing tenant_id = get_user_tenant_id(auth.uid())
-- will deny access rather than non-deterministically pick one of multiple tenants.
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id
  FROM public.tenant_users
  WHERE user_id = p_user_id
    AND (SELECT count(*) FROM public.tenant_users WHERE user_id = p_user_id) = 1
  LIMIT 1;
$function$;

-- 2. Enforce one-tenant-per-user at the schema level.
ALTER TABLE public.tenant_users
  ADD CONSTRAINT tenant_users_user_id_unique UNIQUE (user_id);