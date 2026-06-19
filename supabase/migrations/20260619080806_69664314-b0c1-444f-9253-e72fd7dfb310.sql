DROP POLICY IF EXISTS "Public can create reservations for active tenants" ON public.reservations;

CREATE POLICY "Public can create reservations for active tenants"
ON public.reservations
FOR INSERT
TO anon
WITH CHECK (
  public.is_tenant_active(tenant_id)
  AND status IS NOT DISTINCT FROM 'pending'
  AND is_invoiced IS NOT DISTINCT FROM false
  AND is_checked_in IS NOT DISTINCT FROM false
  AND is_used IS NOT DISTINCT FROM false
  AND price_eur IS NULL
  AND internal_notes IS NULL
  AND staff_notes IS NULL
  AND staff_needed IS NULL
);