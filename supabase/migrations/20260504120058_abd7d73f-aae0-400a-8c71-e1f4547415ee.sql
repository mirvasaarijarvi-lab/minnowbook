-- Update Professional tier to allow up to 5 reservation types (any combo)
-- and remove the 1-per-type resource cap so tenants can mix types freely.

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
    ELSE RETURN 2;
  END CASE;
END;
$function$;

-- Professional: drop per-type cap. Basic still capped to 2 total. Business unlimited.
CREATE OR REPLACE FUNCTION public.enforce_resource_per_type_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text;
  v_current_total integer;
  v_max_total integer;
BEGIN
  IF is_system_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT tier INTO v_tier FROM public.tenants WHERE id = NEW.tenant_id;

  IF v_tier = 'business' THEN
    RETURN NEW;
  END IF;

  IF v_tier = 'basic' THEN
    v_max_total := public.get_tier_max_resources_total(v_tier);
    SELECT count(*) INTO v_current_total
    FROM public.resources
    WHERE tenant_id = NEW.tenant_id;

    IF v_current_total >= v_max_total THEN
      RAISE EXCEPTION
        'Your plan allows only % resource(s) in total. Upgrade to add more.',
        v_max_total;
    END IF;

    RETURN NEW;
  END IF;

  -- Professional: no per-type cap, no total cap (any combo allowed)
  RETURN NEW;
END;
$function$;