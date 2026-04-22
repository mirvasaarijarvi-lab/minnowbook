-- Revert the INSERT lockdown on booking_validation_log: it broke the
-- client-side diagnostic writer (`src/lib/booking-validation-log.ts`)
-- and the security test suite which asserts authenticated tenant
-- members can insert. The PII (guest_name/guest_email) READ surface
-- is already gated to owners/admins via the existing SELECT policy,
-- which is the actual access-control concern. Tightening writes to
-- service-role-only would require moving every dashboard validation
-- logger call into an edge function — out of scope for this fix.

DROP POLICY IF EXISTS "Service role can insert validation log" ON public.booking_validation_log;

DROP POLICY IF EXISTS "Tenant members can insert validation log" ON public.booking_validation_log;
CREATE POLICY "Tenant members can insert validation log"
  ON public.booking_validation_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_user_tenant_member(auth.uid(), tenant_id));