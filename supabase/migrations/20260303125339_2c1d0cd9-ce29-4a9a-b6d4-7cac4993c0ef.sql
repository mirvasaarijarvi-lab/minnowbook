
-- Backfill reservations with NULL site_id by matching reservation_type to site_type via resources
-- Restaurant reservations → site with restaurant resources
UPDATE public.reservations r
SET site_id = sub.site_id
FROM (
  SELECT DISTINCT ON (res2.resource_type) res2.resource_type, res2.site_id
  FROM public.resources res2
  WHERE res2.site_id IS NOT NULL
  ORDER BY res2.resource_type, res2.created_at ASC
) sub
WHERE r.site_id IS NULL
  AND r.reservation_type = sub.resource_type;

-- For any remaining NULL site_id reservations where reservation_type matches site_type directly
UPDATE public.reservations r
SET site_id = sub.site_id
FROM (
  SELECT DISTINCT ON (s.site_type) s.site_type, s.id AS site_id
  FROM public.sites s
  WHERE s.is_active = true
  ORDER BY s.site_type, s.created_at ASC
) sub
WHERE r.site_id IS NULL
  AND r.reservation_type = sub.site_type;
