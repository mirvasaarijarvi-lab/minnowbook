-- Helper functions to introspect reservation indexes and the dashboard query
-- plan from automated tests. Both functions take no user-provided SQL, so
-- they cannot be abused for arbitrary execution.

-- List indexes on public.reservations.
CREATE OR REPLACE FUNCTION public.list_reservations_indexes()
RETURNS TABLE(indexname text, indexdef text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT indexname::text, indexdef::text
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'reservations'
  ORDER BY indexname;
$$;

-- Run EXPLAIN on the canonical dashboard query and return the plan as text.
-- Mirrors the ReservationList default load: tenant + date desc, limited.
CREATE OR REPLACE FUNCTION public.explain_reservations_dashboard(
  p_tenant_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(plan_line text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

-- Allow anon + authenticated to call these (read-only introspection, no user SQL).
GRANT EXECUTE ON FUNCTION public.list_reservations_indexes() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.explain_reservations_dashboard(uuid, integer) TO anon, authenticated, service_role;