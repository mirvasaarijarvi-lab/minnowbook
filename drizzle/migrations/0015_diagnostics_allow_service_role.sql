-- The three read-only schema diagnostics helpers guard on
-- is_system_admin(auth.uid()). Trusted backend callers (service_role) have no
-- auth.uid(), so they were refused; allow them explicitly. Still closed to
-- anon/authenticated non-admins.

CREATE OR REPLACE FUNCTION public.list_reservations_indexes()
 RETURNS TABLE(indexname text, indexdef text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_system_admin(auth.uid()) THEN
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

CREATE OR REPLACE FUNCTION public.explain_reservations_dashboard(p_tenant_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(plan_line text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_system_admin(auth.uid()) THEN
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

CREATE OR REPLACE FUNCTION public.analyze_reservations_dashboard(p_tenant_id uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  EXECUTE
    'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '
    || 'SELECT id, tenant_id, date, status, reservation_type, is_invoiced, '
    || '       guest_name, guest_email, guest_phone '
    || 'FROM public.reservations '
    || 'WHERE tenant_id = $1 '
    || 'ORDER BY date DESC '
    || 'LIMIT $2'
  USING p_tenant_id, p_limit;

  RETURN v_result;
END;
$function$;
