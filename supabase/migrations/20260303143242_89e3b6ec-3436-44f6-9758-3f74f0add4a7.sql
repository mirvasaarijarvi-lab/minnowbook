-- Server-side enforcement: limit resources per type based on tier
CREATE OR REPLACE FUNCTION public.enforce_resource_per_type_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_max_per_type integer;
  v_current_count integer;
BEGIN
  -- System admins bypass limits
  IF is_system_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT tier INTO v_tier FROM public.tenants WHERE id = NEW.tenant_id;

  -- Business tier has no per-type limit
  IF v_tier = 'business' THEN
    RETURN NEW;
  END IF;

  -- Basic and Pro: 1 resource per type
  v_max_per_type := 1;

  SELECT count(*) INTO v_current_count
  FROM public.resources
  WHERE tenant_id = NEW.tenant_id
    AND resource_type = NEW.resource_type;

  IF v_current_count >= v_max_per_type THEN
    RAISE EXCEPTION 'Your plan allows only % resource(s) per type. Upgrade to Business for unlimited resources.', v_max_per_type;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to resources table (only on INSERT)
DROP TRIGGER IF EXISTS enforce_resource_per_type_limit_trigger ON public.resources;
CREATE TRIGGER enforce_resource_per_type_limit_trigger
  BEFORE INSERT ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_resource_per_type_limit();