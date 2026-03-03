
-- Update DB functions to use 'business' instead of 'enterprise'
CREATE OR REPLACE FUNCTION public.get_tier_max_sites(p_tier text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_tier
    WHEN 'basic' THEN 1
    WHEN 'professional' THEN 1
    WHEN 'business' THEN 2147483647
    ELSE 1
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tier_max_reservation_types(p_tier text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_tier
    WHEN 'basic' THEN 1
    WHEN 'professional' THEN 2147483647
    WHEN 'business' THEN 2147483647
    ELSE 1
  END;
$function$;

-- Migrate any existing 'enterprise' tenants to 'business'
UPDATE public.tenants SET tier = 'business' WHERE tier = 'enterprise';
