-- Qualify the ambiguous column names and drop STABLE so EXPLAIN is allowed.
CREATE OR REPLACE FUNCTION public.list_reservations_indexes()
 RETURNS TABLE(indexname text, indexdef text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.diagnostics_caller_is_trusted() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT i.indexname::text, i.indexdef::text
  FROM pg_indexes i
  WHERE i.schemaname = 'public'
    AND i.tablename = 'reservations'
  ORDER BY i.indexname;
END;
$function$;

CREATE OR REPLACE FUNCTION public.explain_reservations_dashboard(p_tenant_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(plan_line text)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.diagnostics_caller_is_trusted() THEN
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
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.diagnostics_caller_is_trusted() THEN
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
