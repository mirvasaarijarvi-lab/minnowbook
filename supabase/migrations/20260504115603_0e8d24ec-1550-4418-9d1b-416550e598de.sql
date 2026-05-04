-- New columns on resources for custom reservation type
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS custom_type_label text,
  ADD COLUMN IF NOT EXISTS sub_services jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Track guest-selected sub-services on reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS selected_sub_services jsonb;

ALTER TABLE public.archived_reservations
  ADD COLUMN IF NOT EXISTS selected_sub_services jsonb;

-- Update trigger so 'custom' isn't capped at 1 per type on Professional;
-- it relies on total cap (Basic) and is otherwise unlimited.
CREATE OR REPLACE FUNCTION public.enforce_resource_per_type_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Professional: 1 per type, but 'custom' is exempt from per-type cap
  IF NEW.resource_type = 'custom' THEN
    RETURN NEW;
  END IF;

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