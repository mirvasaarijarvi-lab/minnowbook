
-- Fix the permissive anonymous INSERT policy for reservations
-- Restrict to only allow inserts where tenant_id references an active tenant
DROP POLICY "Public can create reservations" ON public.reservations;

CREATE POLICY "Public can create reservations for active tenants"
  ON public.reservations FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND is_active = true)
  );
