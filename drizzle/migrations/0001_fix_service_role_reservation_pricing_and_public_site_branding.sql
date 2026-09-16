-- 1. The public reservation insert trigger must only scrub staff/system columns
-- for genuine anonymous/authenticated client inserts. Server-side code paths
-- (edge functions using the service role) compute canonical pricing and must
-- be allowed to persist it.
CREATE OR REPLACE FUNCTION public.validate_public_reservation_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_role text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Trusted server contexts: service role / superuser-ish maintenance roles.
  BEGIN
    v_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role());
  EXCEPTION WHEN others THEN
    v_role := NULL;
  END;

  IF v_role = 'service_role'
     OR current_user IN ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN NEW;
  END IF;

  -- Staff/system-owned lifecycle flags
  NEW.status        := 'pending';
  NEW.is_invoiced   := false;
  NEW.is_checked_in := false;
  NEW.is_used       := false;
  NEW.staff_needed  := false;

  -- Pricing / discount metadata is applied server-side only
  NEW.price_eur          := NULL;
  NEW.original_price_eur := NULL;
  NEW.pricing_details    := NULL;
  NEW.discount_code_id   := NULL;
  NEW.discount_type      := NULL;
  NEW.discount_value     := NULL;
  NEW.discount_reason    := NULL;

  -- Staff-only free text and provenance
  NEW.internal_notes    := NULL;
  NEW.staff_notes       := NULL;
  NEW.created_by        := NULL;
  NEW.guest_search_text := NULL;

  -- Mailer-owned timestamps
  NEW.acknowledgment_email_sent_at := NULL;
  NEW.confirmation_email_sent_at   := NULL;
  NEW.cancellation_email_sent_at   := NULL;
  NEW.reminder_email_sent_at       := NULL;

  v_name := btrim(COALESCE(NEW.guest_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'guest_name is required' USING ERRCODE = '22023';
  END IF;
  IF length(v_name) > 120 THEN
    RAISE EXCEPTION 'guest_name is too long (max 120 chars)' USING ERRCODE = '22023';
  END IF;
  IF v_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'guest_name contains control characters' USING ERRCODE = '22023';
  END IF;
  NEW.guest_name := v_name;

  IF NEW.guest_email IS NOT NULL AND btrim(NEW.guest_email) <> '' THEN
    v_email := lower(btrim(NEW.guest_email));
    IF length(v_email) > 254 THEN
      RAISE EXCEPTION 'guest_email is too long' USING ERRCODE = '22023';
    END IF;
    IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'guest_email has invalid format' USING ERRCODE = '22023';
    END IF;
    NEW.guest_email := v_email;
  ELSE
    NEW.guest_email := NULL;
  END IF;

  IF NEW.guest_phone IS NOT NULL AND btrim(NEW.guest_phone) <> '' THEN
    v_phone := btrim(NEW.guest_phone);
    IF length(v_phone) > 32 THEN
      RAISE EXCEPTION 'guest_phone is too long (max 32 chars)' USING ERRCODE = '22023';
    END IF;
    IF v_phone !~ '^[0-9 +()\-./]+$' THEN
      RAISE EXCEPTION 'guest_phone contains invalid characters' USING ERRCODE = '22023';
    END IF;
    NEW.guest_phone := v_phone;
  ELSE
    NEW.guest_phone := NULL;
  END IF;

  IF NEW.special_requests IS NOT NULL AND length(NEW.special_requests) > 2000 THEN
    RAISE EXCEPTION 'special_requests exceeds 2000 chars' USING ERRCODE = '22023';
  END IF;

  IF NEW.date IS NOT NULL AND NEW.date < (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'reservation date cannot be in the past' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Public booking branding: expose ONLY non-PII branding columns through a
-- SECURITY DEFINER function so guests and non-admin staff can render a site's
-- name, colours and images without any access to business contact PII rows.
CREATE OR REPLACE FUNCTION public.get_site_settings_public(p_site_id uuid)
RETURNS TABLE (
  id uuid,
  site_id uuid,
  tenant_id uuid,
  business_name text,
  business_description text,
  primary_color text,
  secondary_color text,
  accent_color text,
  logo_url text,
  hero_image_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.site_id, s.tenant_id, s.business_name, s.business_description,
         s.primary_color, s.secondary_color, s.accent_color, s.logo_url,
         s.hero_image_url, s.created_at, s.updated_at
  FROM public.site_settings s
  JOIN public.sites si ON si.id = s.site_id
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE s.site_id = p_site_id
    AND si.is_active = true
    AND COALESCE(t.is_active, false) = true
$$;

GRANT EXECUTE ON FUNCTION public.get_site_settings_public(uuid) TO anon, authenticated, service_role;