-- Tighten INSERT permissions on booking_validation_log so only users with
-- reservations.create permission (the only legitimate writers) can log entries.
DROP POLICY IF EXISTS "Tenant members can insert validation log" ON public.booking_validation_log;

CREATE POLICY "Reservation creators can insert validation log"
ON public.booking_validation_log
FOR INSERT
TO authenticated
WITH CHECK (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND has_permission(auth.uid(), 'reservations.create')
);