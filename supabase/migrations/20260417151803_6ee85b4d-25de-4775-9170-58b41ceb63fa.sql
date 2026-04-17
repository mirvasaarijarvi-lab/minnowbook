
-- Remove the anon SELECT policy that exposed guest_email
DROP POLICY IF EXISTS "Anon can view published reviews" ON public.guest_reviews;

-- Replace the safe view to also filter to published reviews only,
-- since this is now the only way for anon to read reviews.
DROP VIEW IF EXISTS public.guest_reviews_safe;

CREATE VIEW public.guest_reviews_safe
WITH (security_invoker = true) AS
SELECT
  id,
  tenant_id,
  site_id,
  reservation_id,
  guest_name,
  rating,
  comment,
  is_published,
  created_at
FROM public.guest_reviews
WHERE is_published = true;

GRANT SELECT ON public.guest_reviews_safe TO authenticated, anon;

-- Allow anon + authenticated to read the safe view.
-- Since the view uses security_invoker, it relies on a base-table policy.
-- Add a column-less SELECT policy scoped to published rows so the view
-- can return data, while the base table is still protected from staff
-- by the owners/admins policy added previously.
CREATE POLICY "Public can view published reviews via safe view"
  ON public.guest_reviews
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);
