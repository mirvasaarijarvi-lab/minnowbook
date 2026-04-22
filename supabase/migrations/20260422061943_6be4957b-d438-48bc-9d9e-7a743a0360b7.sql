
-- Explicitly deny SELECT/INSERT/UPDATE/DELETE for non-admin authenticated users
-- and anonymous users on tables that hold email addresses without tenant scoping.
-- This prevents any future, accidentally-broad policy from exposing PII across tenants.

-- ============================================================
-- email_send_log: deny all access except system admins + service_role
-- ============================================================
DROP POLICY IF EXISTS "Block authenticated users from email_send_log" ON public.email_send_log;
CREATE POLICY "Block authenticated users from email_send_log"
  ON public.email_send_log
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Block anon from email_send_log" ON public.email_send_log;
CREATE POLICY "Block anon from email_send_log"
  ON public.email_send_log
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- suppressed_emails: deny all access except system admins + service_role
-- ============================================================
DROP POLICY IF EXISTS "Block authenticated users from suppressed_emails" ON public.suppressed_emails;
CREATE POLICY "Block authenticated users from suppressed_emails"
  ON public.suppressed_emails
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Block anon from suppressed_emails" ON public.suppressed_emails;
CREATE POLICY "Block anon from suppressed_emails"
  ON public.suppressed_emails
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- email_unsubscribe_tokens: deny all access for authenticated and anon
-- (only service_role manages these via edge functions)
-- ============================================================
DROP POLICY IF EXISTS "Block authenticated users from email_unsubscribe_tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Block authenticated users from email_unsubscribe_tokens"
  ON public.email_unsubscribe_tokens
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Block anon from email_unsubscribe_tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Block anon from email_unsubscribe_tokens"
  ON public.email_unsubscribe_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
