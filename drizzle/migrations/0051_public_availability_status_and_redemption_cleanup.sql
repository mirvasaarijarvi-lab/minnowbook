DROP FUNCTION IF EXISTS public.get_public_availability_counts(uuid, date, date, text[], uuid);

CREATE FUNCTION public.get_public_availability_counts(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_reservation_types text[] DEFAULT NULL::text[],
  p_site_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(day date, day_status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH thresholds AS (
    SELECT ts.availability_thresholds AS t
    FROM public.tenant_settings ts
    WHERE ts.tenant_id = p_tenant_id
    LIMIT 1
  ),
  full_limit AS (
    SELECT COALESCE(
      (SELECT (t ->> p_reservation_types[1])::int FROM thresholds WHERE p_reservation_types IS NOT NULL AND (t ->> p_reservation_types[1]) ~ '^[0-9]+$'),
      (SELECT min((v.value)::int) FROM thresholds, jsonb_each_text(COALESCE(t, '{}'::jsonb)) v WHERE v.value ~ '^[0-9]+$'),
      5
    ) AS n
  )
  SELECT r.date AS day,
         CASE WHEN count(*) >= (SELECT n FROM full_limit) THEN 'full' ELSE 'busy' END AS day_status
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

REVOKE EXECUTE ON FUNCTION public.cleanup_old_redemption_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_redemption_events() TO service_role;