-- Enterprise tier: unlimited everything, sold by offer only.
-- Business: staff users capped at 50 (was effectively unlimited).

CREATE OR REPLACE FUNCTION public.get_tier_max_staff_users(p_tier text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE p_tier
    WHEN 'basic' THEN 5
    WHEN 'professional' THEN 25
    WHEN 'business' THEN 50
    WHEN 'enterprise' THEN 999999
    ELSE 5
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tier_max_sites(p_tier text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE p_tier
    WHEN 'basic' THEN 1
    WHEN 'professional' THEN 1
    WHEN 'business' THEN 999999
    WHEN 'enterprise' THEN 999999
    ELSE 1
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tier_max_resources_total(p_tier text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE p_tier
    WHEN 'basic' THEN 2
    WHEN 'professional' THEN 999999
    WHEN 'business' THEN 999999
    WHEN 'enterprise' THEN 999999
    ELSE 2
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tier_max_reservation_types(p_tier text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  CASE p_tier
    WHEN 'basic' THEN RETURN 2;
    WHEN 'professional' THEN RETURN 5;
    WHEN 'business' THEN RETURN 999;
    WHEN 'enterprise' THEN RETURN 999;
    ELSE RETURN 2;
  END CASE;
END;
$function$;