CREATE POLICY "System admins can read email send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));