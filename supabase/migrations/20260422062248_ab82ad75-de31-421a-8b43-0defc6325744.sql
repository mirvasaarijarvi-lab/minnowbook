
-- Block authenticated/anon access to email_send_state internal config
DROP POLICY IF EXISTS "Block authenticated users from email_send_state" ON public.email_send_state;
CREATE POLICY "Block authenticated users from email_send_state"
  ON public.email_send_state
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Block anon from email_send_state" ON public.email_send_state;
CREATE POLICY "Block anon from email_send_state"
  ON public.email_send_state
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
