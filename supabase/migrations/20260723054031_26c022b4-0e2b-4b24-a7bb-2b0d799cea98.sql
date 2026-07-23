
-- 1. get_unconfirmed_users: require system admin
CREATE OR REPLACE FUNCTION public.get_unconfirmed_users(since_date timestamp with time zone)
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email::text, au.created_at
  FROM auth.users au
  WHERE au.email_confirmed_at IS NULL
    AND au.email IS NOT NULL
    AND au.created_at >= since_date
  ORDER BY au.created_at ASC;
END;
$function$;

-- 2. audit_anon_access: require system admin
CREATE OR REPLACE FUNCTION public.audit_anon_access()
 RETURNS TABLE(object_schema text, object_name text, object_kind text, privilege text, is_base_table boolean, is_flagged boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    n.nspname::text                       AS object_schema,
    c.relname::text                       AS object_name,
    CASE c.relkind
      WHEN 'r' THEN 'table'
      WHEN 'v' THEN 'view'
      WHEN 'm' THEN 'matview'
      WHEN 'f' THEN 'foreign_table'
      WHEN 'p' THEN 'partitioned_table'
      ELSE c.relkind::text
    END                                   AS object_kind,
    p.privilege_type::text                AS privilege,
    (c.relkind IN ('r','p'))              AS is_base_table,
    (
      (c.relkind IN ('r','p'))
      OR p.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
    )                                     AS is_flagged
  FROM information_schema.role_table_grants p
  JOIN pg_class    c ON c.relname  = p.table_name
  JOIN pg_namespace n ON n.oid     = c.relnamespace AND n.nspname = p.table_schema
  WHERE p.grantee = 'anon'
    AND n.nspname = 'public'
  ORDER BY is_flagged DESC, object_name, privilege;
END;
$function$;

-- 3a. explain_reservations_dashboard: require system admin
CREATE OR REPLACE FUNCTION public.explain_reservations_dashboard(p_tenant_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(plan_line text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY EXECUTE
    'EXPLAIN (FORMAT TEXT) '
    || 'SELECT id, tenant_id, date, status, reservation_type, is_invoiced, '
    || '       guest_name, guest_email, guest_phone '
    || 'FROM public.reservations '
    || 'WHERE tenant_id = $1 '
    || 'ORDER BY date DESC '
    || 'LIMIT $2'
  USING p_tenant_id, p_limit;
END;
$function$;

-- 3b. list_reservations_indexes: require system admin
CREATE OR REPLACE FUNCTION public.list_reservations_indexes()
 RETURNS TABLE(indexname text, indexdef text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT indexname::text, indexdef::text
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'reservations'
  ORDER BY indexname;
END;
$function$;

-- 4. get_user_tenant_id: restrict to self, allow system admin
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (
    SELECT tenant_id
    FROM public.tenant_users
    WHERE user_id = p_user_id
      AND (SELECT count(*) FROM public.tenant_users WHERE user_id = p_user_id) = 1
    LIMIT 1
  );
END;
$function$;
