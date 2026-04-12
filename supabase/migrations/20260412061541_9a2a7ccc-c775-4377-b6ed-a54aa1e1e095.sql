
-- Create a secure view for public reviews that excludes guest_email
CREATE OR REPLACE VIEW public.guest_reviews_public AS
SELECT id, tenant_id, site_id, guest_name, rating, comment, created_at, is_published
FROM public.guest_reviews
WHERE is_published = true;

-- Drop the existing anon SELECT policy that exposes all columns
DROP POLICY IF EXISTS "Public can view published reviews safe" ON public.guest_reviews;
