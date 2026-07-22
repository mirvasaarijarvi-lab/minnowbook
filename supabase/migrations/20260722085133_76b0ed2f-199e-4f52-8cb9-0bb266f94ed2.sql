
-- Fix 1: copy_tenant_defaults_to_site — enforce authorization
CREATE OR REPLACE FUNCTION public.copy_tenant_defaults_to_site(p_tenant_id uuid, p_site_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    public.is_system_admin(auth.uid())
    OR (
      public.is_user_tenant_member(auth.uid(), p_tenant_id)
      AND (
        public.has_tenant_role(auth.uid(), 'owner'::app_role, p_tenant_id)
        OR public.has_tenant_role(auth.uid(), 'admin'::app_role, p_tenant_id)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Site does not belong to tenant';
  END IF;

  INSERT INTO tenant_opening_hours (tenant_id, site_id, resource_type, day_of_week, open_time, close_time, is_closed, approval_status)
  SELECT tenant_id, p_site_id, resource_type, day_of_week, open_time, close_time, is_closed, 'approved'
  FROM tenant_opening_hours
  WHERE tenant_id = p_tenant_id AND site_id IS NULL;

  INSERT INTO tenant_email_templates (tenant_id, site_id, template_type, subject, body_html, language, is_active, approval_status)
  SELECT tenant_id, p_site_id, template_type, subject, body_html, language, is_active, 'approved'
  FROM tenant_email_templates
  WHERE tenant_id = p_tenant_id AND site_id IS NULL;
END;
$function$;

-- Fix 2: create_tenant — force basic tier regardless of p_tier
CREATE OR REPLACE FUNCTION public.create_tenant(p_name text, p_slug text, p_tier text DEFAULT 'basic'::text, p_allowed_reservation_types text[] DEFAULT '{}'::text[], p_display_name text DEFAULT NULL::text, p_primary_color text DEFAULT '#2563eb'::text, p_secondary_color text DEFAULT NULL::text, p_accent_color text DEFAULT NULL::text, p_business_description text DEFAULT NULL::text, p_business_email text DEFAULT NULL::text, p_business_phone text DEFAULT NULL::text, p_business_address text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
  v_max_types integer;
  v_effective_tier text := 'basic';  -- always start on basic; upgrades happen via Stripe sync
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug already taken';
  END IF;

  v_max_types := get_tier_max_reservation_types(v_effective_tier);
  IF array_length(p_allowed_reservation_types, 1) IS NOT NULL
     AND array_length(p_allowed_reservation_types, 1) > v_max_types THEN
    RAISE EXCEPTION 'Tier "%" allows at most % reservation type(s)', v_effective_tier, v_max_types;
  END IF;

  INSERT INTO public.tenants (name, slug, tier, allowed_reservation_types, owner_user_id, subscription_status)
  VALUES (p_name, p_slug, v_effective_tier, p_allowed_reservation_types, v_user_id, 'trialing')
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.tenant_users (tenant_id, user_id, role, display_name, is_approved)
  VALUES (v_tenant_id, v_user_id, 'owner', p_display_name, true);

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
$function$;

-- Fix 3: block non-service_role writes to billing-sensitive columns on tenants
CREATE OR REPLACE FUNCTION public.protect_tenant_billing_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := current_setting('role', true);
  v_is_service boolean := (
    current_user IN ('service_role', 'supabase_admin', 'postgres')
    OR v_role IN ('service_role', 'supabase_admin', 'postgres')
  );
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  -- System admins may adjust tier/discount for support; ordinary owners may not.
  IF public.is_system_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.discount_percentage IS DISTINCT FROM OLD.discount_percentage
     OR NEW.discount_reason IS DISTINCT FROM OLD.discount_reason
     OR NEW.discount_granted_by IS DISTINCT FROM OLD.discount_granted_by
     OR NEW.sample_start_date IS DISTINCT FROM OLD.sample_start_date
     OR NEW.sample_end_date IS DISTINCT FROM OLD.sample_end_date THEN
    RAISE EXCEPTION 'Billing-sensitive tenant columns can only be updated by the billing sync service';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_tenant_billing_columns_trg ON public.tenants;
CREATE TRIGGER protect_tenant_billing_columns_trg
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_billing_columns();

-- Fix 4: restrict anonymous discount fields on reservations INSERT
DROP POLICY IF EXISTS "Public can create reservations for active tenants" ON public.reservations;
CREATE POLICY "Public can create reservations for active tenants"
ON public.reservations
FOR INSERT
WITH CHECK (
  is_tenant_active(tenant_id)
  AND (NOT (status IS DISTINCT FROM 'pending'::text))
  AND (NOT (is_invoiced IS DISTINCT FROM false))
  AND (NOT (is_checked_in IS DISTINCT FROM false))
  AND (NOT (is_used IS DISTINCT FROM false))
  AND price_eur IS NULL
  AND internal_notes IS NULL
  AND staff_notes IS NULL
  AND staff_needed IS NULL
  AND discount_code_id IS NULL
  AND discount_type IS NULL
  AND discount_value IS NULL
);
