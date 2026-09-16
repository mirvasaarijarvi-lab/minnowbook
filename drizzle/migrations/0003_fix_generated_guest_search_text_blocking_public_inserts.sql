-- public.reservations.guest_search_text is a STORED GENERATED column, so it is
-- never NULL and can never be supplied by a client. The public INSERT policy
-- required `guest_search_text IS NULL`, which no row can satisfy: every
-- anonymous booking was rejected with a row-level security error. Drop that
-- clause (the column is not attacker-controllable) and keep every other
-- staff-only column locked.
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
  AND acknowledgment_email_sent_at IS NULL
  AND confirmation_email_sent_at IS NULL
  AND cancellation_email_sent_at IS NULL
  AND reminder_email_sent_at IS NULL
);

-- The BEFORE INSERT trigger must not assign to the generated column.
CREATE OR REPLACE FUNCTION public.validate_public_reservation_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_role text;
  v_trusted boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role());
  EXCEPTION WHEN others THEN
    v_role := NULL;
  END;

  -- Explicit trusted-context allowlist: server-side pricing supplied by the
  -- public-booking edge function (service_role) must survive untouched.
  IF v_role = 'service_role'
     OR current_user IN ('service_role', 'supabase_admin', 'postgres') THEN
    v_trusted := true;
  END IF;

  IF NOT v_trusted THEN
    NEW.status        := 'pending';
    NEW.is_invoiced   := false;
    NEW.is_checked_in := false;
    NEW.is_used       := false;
    NEW.staff_needed  := false;

    NEW.price_eur          := NULL;
    NEW.original_price_eur := NULL;
    NEW.pricing_details    := NULL;
    NEW.discount_code_id   := NULL;
    NEW.discount_type      := NULL;
    NEW.discount_value     := NULL;
    NEW.discount_reason    := NULL;

    NEW.internal_notes := NULL;
    NEW.staff_notes    := NULL;
    NEW.created_by     := NULL;

    NEW.acknowledgment_email_sent_at := NULL;
    NEW.confirmation_email_sent_at   := NULL;
    NEW.cancellation_email_sent_at   := NULL;
    NEW.reminder_email_sent_at       := NULL;
  END IF;

  v_name := btrim(COALESCE(NEW.guest_name, ''));
  IF NOT v_trusted THEN
    IF v_name = '' THEN
      RAISE EXCEPTION 'guest_name is required' USING ERRCODE = '22023';
    END IF;
    IF length(v_name) > 120 THEN
      RAISE EXCEPTION 'guest_name is too long (max 120 chars)' USING ERRCODE = '22023';
    END IF;
    IF v_name ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'guest_name contains control characters' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_name <> '' THEN
    NEW.guest_name := v_name;
  END IF;

  IF NEW.guest_email IS NOT NULL AND btrim(NEW.guest_email) <> '' THEN
    v_email := lower(btrim(NEW.guest_email));
    IF NOT v_trusted THEN
      IF length(v_email) > 254 THEN
        RAISE EXCEPTION 'guest_email is too long' USING ERRCODE = '22023';
      END IF;
      IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'guest_email has invalid format' USING ERRCODE = '22023';
      END IF;
    END IF;
    NEW.guest_email := v_email;
  ELSIF NOT v_trusted THEN
    NEW.guest_email := NULL;
  END IF;

  IF NEW.guest_phone IS NOT NULL AND btrim(NEW.guest_phone) <> '' THEN
    v_phone := btrim(NEW.guest_phone);
    IF NOT v_trusted THEN
      IF length(v_phone) > 32 THEN
        RAISE EXCEPTION 'guest_phone is too long (max 32 chars)' USING ERRCODE = '22023';
      END IF;
      IF v_phone !~ '^[0-9 +()\-./]+$' THEN
        RAISE EXCEPTION 'guest_phone contains invalid characters' USING ERRCODE = '22023';
      END IF;
    END IF;
    NEW.guest_phone := v_phone;
  ELSIF NOT v_trusted THEN
    NEW.guest_phone := NULL;
  END IF;

  IF NOT v_trusted THEN
    IF NEW.special_requests IS NOT NULL AND length(NEW.special_requests) > 2000 THEN
      RAISE EXCEPTION 'special_requests exceeds 2000 chars' USING ERRCODE = '22023';
    END IF;

    IF NEW.date IS NOT NULL AND NEW.date < (now() AT TIME ZONE 'UTC')::date THEN
      RAISE EXCEPTION 'reservation date cannot be in the past' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;