CREATE OR REPLACE FUNCTION public.is_user_tenant_member(p_user_id uuid, p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND is_approved = true
  );
$function$;