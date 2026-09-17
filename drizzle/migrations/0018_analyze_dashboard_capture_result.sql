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
  INTO v_result
  USING p_tenant_id, p_limit;

  RETURN v_result;
END;
$function$;
