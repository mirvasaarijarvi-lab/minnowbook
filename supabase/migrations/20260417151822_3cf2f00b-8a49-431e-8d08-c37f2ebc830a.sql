
-- Remove the policy that allowed anon to read the base table directly
DROP POLICY IF EXISTS "Public can view published reviews via safe view" ON public.guest_reviews;

-- Drop the view (functions are a better fit for this pattern)
DROP VIEW IF EXISTS public.guest_reviews_safe;

-- Public-safe function: returns published reviews without email
CREATE OR REPLACE FUNCTION public.get_published_reviews(p_tenant_id uuid, p_site_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  site_id uuid,
  guest_name text,
  rating integer,
  comment text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gr.id,
    gr.tenant_id,
    gr.site_id,
    gr.guest_name,
    gr.rating,
    gr.comment,
    gr.created_at
  FROM public.guest_reviews gr
  WHERE gr.is_published = true
    AND gr.tenant_id = p_tenant_id
    AND (p_site_id IS NULL OR gr.site_id = p_site_id)
  ORDER BY gr.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_published_reviews(uuid, uuid) TO anon, authenticated;
