-- The public booking calendar needs busy/full day markers, not reservation
-- rows. This returns per-day counts only, for active tenants, so a visitor
-- never touches customer data to see availability.
CREATE OR REPLACE FUNCTION public.get_public_availability_counts(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_reservation_types text[] DEFAULT NULL,
  p_site_id uuid DEFAULT NULL
)
RETURNS TABLE (day date, reservation_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.date AS day, count(*)::int AS reservation_count
  FROM public.reservations r
  WHERE r.tenant_id = p_tenant_id
    AND public.is_tenant_active(p_tenant_id)
    AND r.date >= p_from
    AND r.date <= p_to
    AND r.status IN ('pending', 'confirmed')
    AND (p_reservation_types IS NULL OR r.reservation_type = ANY(p_reservation_types))
    AND (p_site_id IS NULL OR r.site_id = p_site_id)
    AND p_to >= p_from
    AND p_to - p_from <= 92
  GROUP BY r.date
$function$;

REVOKE ALL ON FUNCTION public.get_public_availability_counts(uuid, date, date, text[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_availability_counts(uuid, date, date, text[], uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_availability_counts(uuid, date, date, text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_availability_counts(uuid, date, date, text[], uuid) TO service_role;
