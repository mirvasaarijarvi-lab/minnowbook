-- RPC for the dashboard performance regression test.
-- Returns EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) for the canonical
-- reservations dashboard query so the test suite can assert on planner
-- row estimates and actual execution time, not just plan shape.
--
-- SECURITY DEFINER + locked search_path (per project security memory).
-- Restricted to system admins so untrusted callers can't use it as a
-- timing oracle against tenant data.
CREATE OR REPLACE FUNCTION public.analyze_reservations_dashboard(
  p_tenant_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
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
$$;

REVOKE ALL ON FUNCTION public.analyze_reservations_dashboard(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analyze_reservations_dashboard(uuid, integer) TO authenticated, service_role;