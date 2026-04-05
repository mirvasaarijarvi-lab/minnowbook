
-- Recreate view with SECURITY INVOKER (safe pattern)
CREATE OR REPLACE VIEW public.guest_reviews_public
WITH (security_invoker = true)
AS
SELECT
  id,
  tenant_id,
  site_id,
  guest_name,
  rating,
  comment,
  created_at
FROM public.guest_reviews
WHERE is_published = true;
