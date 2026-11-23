DROP POLICY IF EXISTS "Staff can create booking tokens" ON public.booking_tokens;
REVOKE INSERT ON public.booking_tokens FROM anon, authenticated;