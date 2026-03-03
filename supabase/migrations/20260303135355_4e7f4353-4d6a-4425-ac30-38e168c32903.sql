
-- Update enforce_site_limit to allow system admins to bypass tier limits
CREATE OR REPLACE FUNCTION public.enforce_site_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text;
  v_max_sites integer;
  v_current_count integer;
BEGIN
  -- System admins bypass tier limits
  IF is_system_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT tier INTO v_tier FROM public.tenants WHERE id = NEW.tenant_id;

  v_max_sites := get_tier_max_sites(v_tier);

  SELECT count(*) INTO v_current_count
  FROM public.sites
  WHERE tenant_id = NEW.tenant_id;

  IF v_current_count >= v_max_sites THEN
    RAISE EXCEPTION 'Tier "%" allows at most % site(s). Upgrade to add more.', v_tier, v_max_sites;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also update enforce_reservation_type_limit for consistency
CREATE OR REPLACE FUNCTION public.enforce_reservation_type_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_max_types integer;
BEGIN
  -- System admins bypass tier limits
  IF is_system_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.allowed_reservation_types IS DISTINCT FROM OLD.allowed_reservation_types THEN
    v_max_types := get_tier_max_reservation_types(NEW.tier);
    IF array_length(NEW.allowed_reservation_types, 1) IS NOT NULL
       AND array_length(NEW.allowed_reservation_types, 1) > v_max_types THEN
      RAISE EXCEPTION 'Tier "%" allows at most % reservation type(s). Upgrade to add more.', NEW.tier, v_max_types;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
