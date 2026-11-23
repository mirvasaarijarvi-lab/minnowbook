-- Guest portal links are minted only by server functions (service role).
-- Members must not insert tokens, because a chosen token lets them act as the guest.
DROP POLICY IF EXISTS "Staff can create booking tokens" ON public.booking_tokens;
REVOKE INSERT ON public.booking_tokens FROM anon, authenticated;
