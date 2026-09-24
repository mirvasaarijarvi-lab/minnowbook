ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL;
ALTER TABLE public.archived_reservations
  ADD COLUMN IF NOT EXISTS resource_id uuid;

COMMENT ON COLUMN public.reservations.resource_id IS 'The resource (room, table, space, service) the guest booked. Nullable for legacy rows.';

CREATE INDEX IF NOT EXISTS idx_reservations_resource_date
  ON public.reservations (tenant_id, resource_id, date)
  WHERE resource_id IS NOT NULL;

-- A reservation may only point at a resource of its own tenant.
CREATE OR REPLACE FUNCTION public.enforce_reservation_resource_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.resource_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = NEW.resource_id AND r.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Resource does not belong to this organisation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_resource_tenant ON public.reservations;
CREATE TRIGGER trg_reservation_resource_tenant
  BEFORE INSERT OR UPDATE OF resource_id, tenant_id ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reservation_resource_tenant();

-- Backfill 1: bookings tied to a special occasion that names a resource.
UPDATE public.reservations res
SET resource_id = so.resource_id
FROM public.special_occasions so
WHERE res.resource_id IS NULL
  AND res.special_occasion_id = so.id
  AND so.resource_id IS NOT NULL
  AND so.tenant_id = res.tenant_id;

-- Backfill 2: the tenant has exactly one resource of that service type
-- (per site when the booking has a site), so there is no ambiguity.
UPDATE public.reservations res
SET resource_id = only_one.id
FROM (
  SELECT r.tenant_id, r.resource_type, r.site_id, (array_agg(r.id))[1] AS id
  FROM public.resources r
  GROUP BY r.tenant_id, r.resource_type, r.site_id
  HAVING count(*) = 1
) only_one
WHERE res.resource_id IS NULL
  AND only_one.tenant_id = res.tenant_id
  AND only_one.resource_type = res.reservation_type
  AND only_one.site_id IS NOT DISTINCT FROM res.site_id;