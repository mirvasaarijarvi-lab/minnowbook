
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
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
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
