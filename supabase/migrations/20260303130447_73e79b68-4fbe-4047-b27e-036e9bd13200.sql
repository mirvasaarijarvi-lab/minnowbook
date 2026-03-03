
-- Helper function to enforce tier limits
CREATE OR REPLACE FUNCTION public.get_tier_max_sites(p_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'basic' THEN 1
    WHEN 'professional' THEN 1
    WHEN 'enterprise' THEN 2147483647 -- effectively unlimited
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_tier_max_reservation_types(p_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'basic' THEN 1
    WHEN 'professional' THEN 2147483647
    WHEN 'enterprise' THEN 2147483647
    ELSE 1
  END;
$$;

-- Update create_tenant to enforce reservation type limits
CREATE OR REPLACE FUNCTION public.create_tenant(
  p_name text,
  p_slug text,
  p_tier text DEFAULT 'basic',
  p_allowed_reservation_types text[] DEFAULT '{}',
  p_display_name text DEFAULT NULL,
  p_primary_color text DEFAULT '#2563eb',
  p_secondary_color text DEFAULT NULL,
  p_accent_color text DEFAULT NULL,
  p_business_description text DEFAULT NULL,
  p_business_email text DEFAULT NULL,
  p_business_phone text DEFAULT NULL,
  p_business_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
  v_max_types integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check user doesn't already have a tenant
  IF EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  -- Check slug uniqueness
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug already taken';
  END IF;

  -- Enforce tier limit on reservation types
  v_max_types := get_tier_max_reservation_types(p_tier);
  IF array_length(p_allowed_reservation_types, 1) IS NOT NULL
     AND array_length(p_allowed_reservation_types, 1) > v_max_types THEN
    RAISE EXCEPTION 'Tier "%" allows at most % reservation type(s)', p_tier, v_max_types;
  END IF;

  -- Create tenant
  INSERT INTO public.tenants (name, slug, tier, allowed_reservation_types, owner_user_id, subscription_status)
  VALUES (p_name, p_slug, p_tier, p_allowed_reservation_types, v_user_id, 'trialing')
  RETURNING id INTO v_tenant_id;

  -- Create tenant_user as owner
  INSERT INTO public.tenant_users (tenant_id, user_id, role, display_name, is_approved)
  VALUES (v_tenant_id, v_user_id, 'owner', p_display_name, true);

  -- Create tenant_settings
  INSERT INTO public.tenant_settings (
    tenant_id, business_name, business_description, business_email,
    business_phone, business_address, primary_color, secondary_color, accent_color
  )
  VALUES (
    v_tenant_id, p_name, p_business_description, p_business_email,
    p_business_phone, p_business_address, p_primary_color, p_secondary_color, p_accent_color
  );

  RETURN v_tenant_id;
END;
$$;

-- Trigger to enforce site creation limits based on tier
CREATE OR REPLACE FUNCTION public.enforce_site_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier text;
  v_max_sites integer;
  v_current_count integer;
BEGIN
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
$$;

CREATE TRIGGER enforce_site_limit_trigger
BEFORE INSERT ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.enforce_site_limit();

-- Trigger to enforce reservation type limits on tenant update
CREATE OR REPLACE FUNCTION public.enforce_reservation_type_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_types integer;
BEGIN
  IF NEW.allowed_reservation_types IS DISTINCT FROM OLD.allowed_reservation_types THEN
    v_max_types := get_tier_max_reservation_types(NEW.tier);
    IF array_length(NEW.allowed_reservation_types, 1) IS NOT NULL
       AND array_length(NEW.allowed_reservation_types, 1) > v_max_types THEN
      RAISE EXCEPTION 'Tier "%" allows at most % reservation type(s). Upgrade to add more.', NEW.tier, v_max_types;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_reservation_type_limit_trigger
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.enforce_reservation_type_limit();
