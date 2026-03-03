
-- Update get_tier_max_sites: business = 3, enterprise = unlimited
CREATE OR REPLACE FUNCTION public.get_tier_max_sites(p_tier text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $$
  SELECT CASE p_tier
    WHEN 'basic' THEN 1
    WHEN 'professional' THEN 1
    WHEN 'business' THEN 3
    WHEN 'enterprise' THEN 2147483647
    ELSE 1
  END;
$$;

-- Update get_tier_max_reservation_types: enterprise = unlimited
CREATE OR REPLACE FUNCTION public.get_tier_max_reservation_types(p_tier text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $$
  SELECT CASE p_tier
    WHEN 'basic' THEN 1
    WHEN 'professional' THEN 2147483647
    WHEN 'business' THEN 2147483647
    WHEN 'enterprise' THEN 2147483647
    ELSE 1
  END;
$$;
