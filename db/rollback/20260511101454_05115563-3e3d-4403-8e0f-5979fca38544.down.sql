-- Rollback companion for:
--   supabase/migrations/20260511101454_05115563-3e3d-4403-8e0f-5979fca38544.sql
--
-- Drops the 11 indexes that the forward migration creates on
-- public.reservations. Idempotent: safe to re-run.
--
-- Intentionally does NOT drop the pg_trgm extension. Other migrations
-- (and the trigram indexes added by 20260511102239_…sql) depend on it.

DROP INDEX IF EXISTS public.idx_reservations_capacity_lookup;
DROP INDEX IF EXISTS public.idx_reservations_guest_phone_trgm;
DROP INDEX IF EXISTS public.idx_reservations_guest_email_trgm;
DROP INDEX IF EXISTS public.idx_reservations_guest_name_trgm;
DROP INDEX IF EXISTS public.idx_reservations_tenant_email;
DROP INDEX IF EXISTS public.idx_reservations_tenant_checkout;
DROP INDEX IF EXISTS public.idx_reservations_tenant_invoiced;
DROP INDEX IF EXISTS public.idx_reservations_tenant_type;
DROP INDEX IF EXISTS public.idx_reservations_tenant_status;
DROP INDEX IF EXISTS public.idx_reservations_tenant_date;
