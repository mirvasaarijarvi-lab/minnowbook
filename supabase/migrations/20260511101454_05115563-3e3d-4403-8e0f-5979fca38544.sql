-- Fast-lookup indexes for the reservations dashboard and public booking flows.
-- The reservations table itself already exists; this migration only adds indexes.

-- pg_trgm enables fast case-insensitive ILIKE substring search on guest fields.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Main listing: scoped by tenant, ordered by date desc.
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_date
  ON public.reservations (tenant_id, date DESC);

-- Status / type / invoiced filters (each scoped by tenant).
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_status
  ON public.reservations (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_tenant_type
  ON public.reservations (tenant_id, reservation_type);

CREATE INDEX IF NOT EXISTS idx_reservations_tenant_invoiced
  ON public.reservations (tenant_id, is_invoiced);

-- Hotel/guesthouse "checking out today" filter.
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_checkout
  ON public.reservations (tenant_id, check_out_date)
  WHERE check_out_date IS NOT NULL;

-- Direct guest_email lookup (used by capacity checks and admin tools).
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_email
  ON public.reservations (tenant_id, guest_email);

-- Trigram indexes power the ILIKE search across guest_name / email / phone.
CREATE INDEX IF NOT EXISTS idx_reservations_guest_name_trgm
  ON public.reservations USING gin (guest_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reservations_guest_email_trgm
  ON public.reservations USING gin (guest_email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reservations_guest_phone_trgm
  ON public.reservations USING gin (guest_phone gin_trgm_ops);

-- Capacity check: tenant + type + date (already partially covered, but a
-- dedicated composite avoids re-sorting in the public-booking function).
CREATE INDEX IF NOT EXISTS idx_reservations_capacity_lookup
  ON public.reservations (tenant_id, reservation_type, date)
  WHERE status <> 'cancelled';