
-- Hide internal `note` column from anonymous users on resource_availability_slots
REVOKE SELECT ON public.resource_availability_slots FROM anon;
GRANT SELECT (id, tenant_id, resource_id, slot_date, start_time, end_time, created_at, updated_at)
  ON public.resource_availability_slots TO anon;

-- Harden the public reservations INSERT policy: keep the existing gating and
-- explicitly force additional server/staff-only columns to NULL/default so
-- anonymous guests can never seed them via the public booking flow.
DROP POLICY IF EXISTS "Public can create reservations for active tenants" ON public.reservations;

CREATE POLICY "Public can create reservations for active tenants"
ON public.reservations
FOR INSERT
TO public
WITH CHECK (
  is_tenant_active(tenant_id)
  AND (status IS NOT DISTINCT FROM 'pending'::text)
  AND (is_invoiced IS NOT DISTINCT FROM false)
  AND (is_checked_in IS NOT DISTINCT FROM false)
  AND (is_used IS NOT DISTINCT FROM false)
  AND price_eur IS NULL
  AND internal_notes IS NULL
  AND staff_notes IS NULL
  AND staff_needed IS NOT DISTINCT FROM false
  AND discount_code_id IS NULL
  AND discount_type IS NULL
  AND discount_value IS NULL
  AND discount_reason IS NULL
  AND original_price_eur IS NULL
  AND pricing_details IS NULL
  AND created_by IS NULL
  AND acknowledgment_email_sent_at IS NULL
  AND confirmation_email_sent_at IS NULL
  AND cancellation_email_sent_at IS NULL
  AND reminder_email_sent_at IS NULL
);
