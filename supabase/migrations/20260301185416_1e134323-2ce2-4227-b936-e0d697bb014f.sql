-- System admins can view all reservations (for stats)
CREATE POLICY "System admins can view all reservations"
  ON public.reservations
  FOR SELECT
  USING (is_system_admin(auth.uid()));

-- System admins can view all resources (for stats)
CREATE POLICY "System admins can view all resources"
  ON public.resources
  FOR SELECT
  USING (is_system_admin(auth.uid()));
