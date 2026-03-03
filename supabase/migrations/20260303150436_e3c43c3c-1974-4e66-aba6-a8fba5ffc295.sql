
-- Update the get_tier_max_sites function to return 3 for business tier
CREATE OR REPLACE FUNCTION public.get_tier_max_sites(p_tier text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_tier
    WHEN 'basic' THEN 1
    WHEN 'professional' THEN 1
    WHEN 'business' THEN 3
    WHEN 'enterprise' THEN 999999
    ELSE 1
  END;
$$;
