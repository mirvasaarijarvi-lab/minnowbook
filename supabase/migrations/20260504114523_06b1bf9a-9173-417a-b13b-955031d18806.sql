-- Update Basic tier: 2 reservation types and total resource cap of 2 (any types)

-- 1) Reservation types: Basic now allows 2
CREATE OR REPLACE FUNCTION public.get_tier_max_reservation_types(p_tier text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  CASE p_tier
    WHEN 'basic' THEN RETURN 2;
    WHEN 'professional' THEN RETURN 999;
    WHEN 'business' THEN RETURN 999;
    ELSE RETURN 2;
  END CASE;
END;
$function$;

-- 2) New helper: total resource cap per tenant (Basic only)
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
    ELSE 2
  END;
$function$;

-- 3) Replace per-type trigger with: Basic = total cap of 2 (any types),
--    Professional = 1 per type, Business = unlimited
CREATE OR REPLACE FUNCTION public.enforce_resource_per_type_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text;
  v_current_total integer;
  v_current_per_type integer;
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
    -- Total cap across all resource types
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

  -- Professional: 1 per type
  SELECT count(*) INTO v_current_per_type
  FROM public.resources
  WHERE tenant_id = NEW.tenant_id
    AND resource_type = NEW.resource_type;

  IF v_current_per_type >= 1 THEN
    RAISE EXCEPTION
      'Your plan allows only 1 resource(s) per type. Upgrade to Business for unlimited resources.';
  END IF;

  RETURN NEW;
END;
$function$;