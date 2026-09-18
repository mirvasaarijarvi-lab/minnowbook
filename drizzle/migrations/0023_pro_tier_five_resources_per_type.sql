-- Professional tier: allow up to 5 resources per reservation type.
CREATE OR REPLACE FUNCTION public.get_tier_max_resources_per_type(p_tier text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  CASE p_tier
    WHEN 'professional' THEN RETURN 5;
    WHEN 'business' THEN RETURN 999999;
    WHEN 'enterprise' THEN RETURN 999999;
    ELSE RETURN 999999; -- basic is capped by total, not per type
  END CASE;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_tier_max_resources_per_type(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tier_max_resources_per_type(text) TO authenticated;

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
  v_current_type integer;
  v_max_per_type integer;
BEGIN
  IF is_system_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT tier INTO v_tier FROM public.tenants WHERE id = NEW.tenant_id;

  IF v_tier IN ('business', 'enterprise') THEN
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

  -- Professional: up to 5 resources per reservation type, no total cap.
  v_max_per_type := public.get_tier_max_resources_per_type(v_tier);
  SELECT count(*) INTO v_current_type
  FROM public.resources
  WHERE tenant_id = NEW.tenant_id
    AND resource_type = NEW.resource_type;

  IF v_current_type >= v_max_per_type THEN
    RAISE EXCEPTION
      'Your plan allows only % resource(s) per type. Upgrade to Business for unlimited resources.',
      v_max_per_type;
  END IF;

  RETURN NEW;
END;
$function$;