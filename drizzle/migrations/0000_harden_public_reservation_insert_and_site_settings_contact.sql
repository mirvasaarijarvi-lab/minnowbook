-- 1. Make the public reservation insert trigger authoritative: it now scrubs
-- every staff/system-owned column for anonymous inserts, so the RLS WITH CHECK
-- is defense-in-depth rather than the only guard.
CREATE OR REPLACE FUNCTION public.validate_public_reservation_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
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

-- 2. Belt-and-braces on availability slot notes: keep anon column grants
-- explicit (table-level SELECT stays revoked, `note` stays hidden).
REVOKE SELECT ON public.resource_availability_slots FROM anon;
GRANT SELECT (id, tenant_id, resource_id, slot_date, start_time, end_time, created_at, updated_at)
  ON public.resource_availability_slots TO anon;

-- 3. Business contact PII in site_settings: restrict row reads to owners/admins.
DROP POLICY IF EXISTS "Tenant members can view site settings" ON public.site_settings;

CREATE POLICY "Owners/admins can view site settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND (
    has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
  )
);