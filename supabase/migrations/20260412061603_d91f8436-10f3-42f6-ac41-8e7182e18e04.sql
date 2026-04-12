
-- Re-add anon SELECT on the base table so the SECURITY INVOKER view works
CREATE POLICY "Anon can view published reviews"
ON public.guest_reviews
FOR SELECT
TO anon
USING (is_published = true);
