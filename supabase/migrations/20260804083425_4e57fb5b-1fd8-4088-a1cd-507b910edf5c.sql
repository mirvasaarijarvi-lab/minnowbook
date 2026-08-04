-- 1. Reservations: pin guest_search_text (internal, system-maintained) on public inserts
DROP POLICY IF EXISTS "Public can create reservations for active tenants" ON public.reservations;
CREATE POLICY "Public can create reservations for active tenants"
ON public.reservations
FOR INSERT
WITH CHECK (
  is_tenant_active(tenant_id)
  AND NOT (status IS DISTINCT FROM 'pending'::text)
  AND NOT (is_invoiced IS DISTINCT FROM false)
  AND NOT (is_checked_in IS DISTINCT FROM false)
  AND NOT (is_used IS DISTINCT FROM false)
  AND NOT (staff_needed IS DISTINCT FROM false)
  AND price_eur IS NULL
  AND original_price_eur IS NULL
  AND pricing_details IS NULL
  AND discount_code_id IS NULL
  AND discount_type IS NULL
  AND discount_value IS NULL
  AND discount_reason IS NULL
  AND internal_notes IS NULL
  AND staff_notes IS NULL
  AND created_by IS NULL
  AND guest_search_text IS NULL
  AND acknowledgment_email_sent_at IS NULL
  AND confirmation_email_sent_at IS NULL
  AND cancellation_email_sent_at IS NULL
  AND reminder_email_sent_at IS NULL
);

-- 2. Waitlist: server-side format/length validation for anonymous PII
CREATE OR REPLACE FUNCTION public.validate_public_waitlist_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.guest_name := btrim(NEW.guest_name);
  NEW.guest_email := lower(btrim(NEW.guest_email));
  NEW.guest_phone := NULLIF(btrim(COALESCE(NEW.guest_phone, '')), '');

  IF NEW.guest_name IS NULL OR length(NEW.guest_name) < 1 OR length(NEW.guest_name) > 100 THEN
    RAISE EXCEPTION 'Invalid guest name';
  END IF;

  IF NEW.guest_email IS NULL OR length(NEW.guest_email) > 255
     OR NEW.guest_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid guest email';
  END IF;

  IF NEW.guest_phone IS NOT NULL
     AND (length(NEW.guest_phone) > 32 OR NEW.guest_phone !~ '^[0-9+()./ -]+$') THEN
    RAISE EXCEPTION 'Invalid guest phone';
  END IF;

  IF NEW.resource_type IS NULL OR length(NEW.resource_type) > 50 THEN
    RAISE EXCEPTION 'Invalid resource type';
  END IF;

  IF NEW.preferred_date IS NULL
     OR NEW.preferred_date < (now() AT TIME ZONE 'UTC')::date - 1
     OR NEW.preferred_date > (now() AT TIME ZONE 'UTC')::date + 730 THEN
    RAISE EXCEPTION 'Invalid preferred date';
  END IF;

  -- Status is staff-owned; force the default on insert.
  NEW.status := 'pending';
  NEW.notified_at := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_public_waitlist_insert_trg ON public.waitlist;
CREATE TRIGGER validate_public_waitlist_insert_trg
BEFORE INSERT ON public.waitlist
FOR EACH ROW EXECUTE FUNCTION public.validate_public_waitlist_insert();