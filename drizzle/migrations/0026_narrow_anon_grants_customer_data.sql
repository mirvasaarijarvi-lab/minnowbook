-- Narrow the signed-out (anon) role's privileges on every table holding
-- customer or reservation data down to exactly what the public booking flow
-- needs. Row level security already blocked these paths; removing the grants
-- means a future policy mistake cannot expose another account's data either.
--
-- Kept: INSERT on the three tables a visitor legitimately writes to
--   reservations   -- public booking, validated by WITH CHECK
--   waitlist       -- join waitlist for an active tenant
--   guest_reviews  -- review submitted with a single-use token
-- Everything a visitor reads goes through SECURITY DEFINER functions
-- (lookup_booking_token, get_published_reviews, ...), never these tables.

REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.reservations FROM anon;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.waitlist FROM anon;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.guest_reviews FROM anon;

REVOKE ALL ON public.archived_reservations FROM anon;
REVOKE ALL ON public.offers FROM anon;
REVOKE ALL ON public.booking_validation_log FROM anon;
REVOKE ALL ON public.auth_failure_log FROM anon;
REVOKE ALL ON public.reservation_access_log FROM anon;
REVOKE ALL ON public.email_send_log FROM anon;
REVOKE ALL ON public.email_unsubscribe_tokens FROM anon;
REVOKE ALL ON public.suppressed_emails FROM anon;
REVOKE ALL ON public.booking_tokens FROM anon;

-- Signed-in staff and the service role keep their existing access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT SELECT ON public.booking_validation_log TO authenticated;
GRANT SELECT ON public.auth_failure_log TO authenticated;
GRANT SELECT ON public.reservation_access_log TO authenticated;
GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.reservations TO service_role;
GRANT ALL ON public.waitlist TO service_role;
GRANT ALL ON public.guest_reviews TO service_role;
GRANT ALL ON public.archived_reservations TO service_role;
GRANT ALL ON public.offers TO service_role;
GRANT ALL ON public.booking_validation_log TO service_role;
GRANT ALL ON public.auth_failure_log TO service_role;
GRANT ALL ON public.reservation_access_log TO service_role;
GRANT ALL ON public.email_send_log TO service_role;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
GRANT ALL ON public.suppressed_emails TO service_role;
GRANT ALL ON public.booking_tokens TO service_role;
