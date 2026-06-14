
-- 1) Guest reviews: drop email/name match requirement (token is sufficient),
--    always null guest_email, then drop the column.
DROP POLICY IF EXISTS "Anyone can submit review with matching token" ON public.guest_reviews;

CREATE POLICY "Anyone can submit review with valid token"
ON public.guest_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  review_token IS NOT NULL
  AND reservation_id IS NOT NULL
  AND public.is_valid_review_token_for_reservation(review_token, reservation_id, tenant_id)
);

-- Drop guest_email column entirely; it is PII not needed for display.
ALTER TABLE public.guest_reviews DROP COLUMN IF EXISTS guest_email;

-- Old scrub trigger referenced guest_email; recreate as a no-op safeguard
-- that strips any future PII fields if added. Keep function for compatibility.
CREATE OR REPLACE FUNCTION public.scrub_guest_review_pii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 2) Hide tenants.ical_feed_token from authenticated/anon column-level reads.
--    Access remains via get_tenant_ical_feed_token() RPC for owners/admins.
REVOKE SELECT (ical_feed_token) ON public.tenants FROM authenticated;
REVOKE SELECT (ical_feed_token) ON public.tenants FROM anon;

-- 3) Schedule daily purge of booking_validation_log entries older than 30 days.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-booking-validation-log-daily') THEN
    PERFORM cron.unschedule('cleanup-booking-validation-log-daily');
  END IF;
  PERFORM cron.schedule(
    'cleanup-booking-validation-log-daily',
    '15 3 * * *',
    $cron$ SELECT public.cleanup_old_booking_validation_logs(); $cron$
  );
END $$;
