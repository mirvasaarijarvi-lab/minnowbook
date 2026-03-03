
-- Remove enterprise tier from DB functions, Business becomes top tier with unlimited sites
CREATE OR REPLACE FUNCTION public.get_tier_max_sites(p_tier text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_tier
    WHEN 'basic' THEN RETURN 1;
    WHEN 'professional' THEN RETURN 1;
    WHEN 'business' THEN RETURN 999;  -- effectively unlimited
    ELSE RETURN 1;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tier_max_reservation_types(p_tier text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_tier
    WHEN 'basic' THEN RETURN 1;
    WHEN 'professional' THEN RETURN 999;
    WHEN 'business' THEN RETURN 999;
    ELSE RETURN 1;
  END CASE;
END;
$$;
