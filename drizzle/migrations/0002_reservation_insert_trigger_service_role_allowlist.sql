-- Explicit trusted-context allowlist for the public reservation BEFORE INSERT
-- trigger.
--
-- Background: anonymous (guest) inserts must never set pricing, discount,
-- staff or mailer columns, so those are scrubbed. Server-side inserts from the
-- `public-booking` edge function run as `service_role` and also have a NULL
-- auth.uid(), so without an explicit exception the canonical price computed on
-- the server was discarded.
--
-- This version makes the exception explicit and narrow:
--   * `v_trusted` is true only for service_role / supabase_admin / postgres.
--   * The scrub block (pricing, discount, staff flags, provenance, mailer
--     timestamps) is skipped for trusted contexts: those columns are the
--     allowlist that server-side pricing is allowed to supply.
--   * Guest identity fields are still normalised for every caller.
--   * Hard validation failures (missing name, bad email, past date) remain
--     guest-input protection and are not applied to trusted server inserts,
--     which legitimately seed historical and system-generated rows.
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
  -- Authenticated staff/dashboard inserts are governed by RLS + permissions.
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role());
  EXCEPTION WHEN others THEN
    v_role := NULL;
  END;

  IF v_role = 'service_role'
     OR current_user IN ('service_role', 'supabase_admin', 'postgres') THEN
    v_trusted := true;
  END IF;

  IF NOT v_trusted THEN
    -- Staff/system-owned lifecycle flags
    NEW.status        := 'pending';
    NEW.is_invoiced   := false;
    NEW.is_checked_in := false;
    NEW.is_used       := false;
    NEW.staff_needed  := false;

    -- ALLOWLISTED FOR TRUSTED SERVER CONTEXTS ONLY:
    -- pricing / discount metadata is computed server-side.
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
  END IF;

  -- Guest identity normalisation applies to every anon-uid caller.
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