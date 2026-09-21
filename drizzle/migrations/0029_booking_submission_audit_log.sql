-- Audit logging for public booking submissions and system-assigned fields.
CREATE OR REPLACE FUNCTION public.log_booking_submission(
  p_tenant_id uuid,
  p_reservation_id uuid,
  p_trusted boolean,
  p_jwt_role text,
  p_db_user text,
  p_system_assigned jsonb,
  p_scrubbed text[],
  p_submitted jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log (
    tenant_id, user_id, table_name, record_id, action, summary, old_data, new_data
  ) VALUES (
    p_tenant_id,
    auth.uid(),
    'reservations',
    p_reservation_id,
    'booking_submission',
    CASE
      WHEN p_trusted THEN 'Server booking submission (trusted caller)'
      ELSE 'Public booking submission: system assigned '
           || COALESCE(nullif(array_to_string(
                ARRAY(SELECT jsonb_object_keys(COALESCE(p_system_assigned, '{}'::jsonb))), ', '
              ), ''), '(none)')
           || CASE
                WHEN COALESCE(array_length(p_scrubbed, 1), 0) > 0
                  THEN '; discarded submitted ' || array_to_string(p_scrubbed, ', ')
                ELSE ''
              END
    END,
    NULL,
    jsonb_build_object(
      'source', CASE WHEN p_trusted THEN 'server' ELSE 'public_form' END,
      'trusted', p_trusted,
      'jwt_role', p_jwt_role,
      'db_user', p_db_user,
      'system_assigned', COALESCE(p_system_assigned, '{}'::jsonb),
      'discarded_fields', COALESCE(to_jsonb(p_scrubbed), '[]'::jsonb),
      'submitted_values', COALESCE(p_submitted, '{}'::jsonb)
    )
  );
EXCEPTION WHEN others THEN
  RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_booking_submission(uuid, uuid, boolean, text, text, jsonb, text[], jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.validate_public_reservation_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_role text;
  v_trusted boolean := false;
  v_supplied text[] := ARRAY[]::text[];
  v_submitted jsonb := '{}'::jsonb;
  v_staff_supplied text[] := ARRAY[]::text[];
  v_system_assigned jsonb := '{}'::jsonb;
BEGIN
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

  IF NEW.price_eur IS NOT NULL THEN
    v_supplied := array_append(v_supplied, 'price_eur'::text);
    v_submitted := v_submitted || jsonb_build_object('price_eur', NEW.price_eur);
  END IF;
  IF NEW.original_price_eur IS NOT NULL THEN
    v_supplied := array_append(v_supplied, 'original_price_eur'::text);
    v_submitted := v_submitted || jsonb_build_object('original_price_eur', NEW.original_price_eur);
  END IF;
  IF NEW.pricing_details IS NOT NULL THEN
    v_supplied := array_append(v_supplied, 'pricing_details'::text);
  END IF;
  IF NEW.discount_code_id IS NOT NULL THEN
    v_supplied := array_append(v_supplied, 'discount_code_id'::text);
    v_submitted := v_submitted || jsonb_build_object('discount_code_id', NEW.discount_code_id);
  END IF;
  IF NEW.discount_type IS NOT NULL THEN
    v_supplied := array_append(v_supplied, 'discount_type'::text);
    v_submitted := v_submitted || jsonb_build_object('discount_type', NEW.discount_type);
  END IF;
  IF NEW.discount_value IS NOT NULL THEN
    v_supplied := array_append(v_supplied, 'discount_value'::text);
    v_submitted := v_submitted || jsonb_build_object('discount_value', NEW.discount_value);
  END IF;
  IF NEW.discount_reason IS NOT NULL THEN
    v_supplied := array_append(v_supplied, 'discount_reason'::text);
  END IF;

  -- Staff/system-owned fields outside the pricing set, tracked for the
  -- booking-submission audit entry only (pricing audit shape unchanged).
  IF NEW.status IS NOT NULL AND NEW.status <> 'pending' THEN
    v_staff_supplied := array_append(v_staff_supplied, 'status'::text);
    v_submitted := v_submitted || jsonb_build_object('status', NEW.status);
  END IF;
  IF COALESCE(NEW.is_invoiced, false) THEN
    v_staff_supplied := array_append(v_staff_supplied, 'is_invoiced'::text);
  END IF;
  IF COALESCE(NEW.is_checked_in, false) THEN
    v_staff_supplied := array_append(v_staff_supplied, 'is_checked_in'::text);
  END IF;
  IF COALESCE(NEW.is_used, false) THEN
    v_staff_supplied := array_append(v_staff_supplied, 'is_used'::text);
  END IF;
  IF COALESCE(NEW.staff_needed, false) THEN
    v_staff_supplied := array_append(v_staff_supplied, 'staff_needed'::text);
  END IF;
  IF NEW.internal_notes IS NOT NULL THEN
    v_staff_supplied := array_append(v_staff_supplied, 'internal_notes'::text);
  END IF;
  IF NEW.staff_notes IS NOT NULL THEN
    v_staff_supplied := array_append(v_staff_supplied, 'staff_notes'::text);
  END IF;
  IF NEW.created_by IS NOT NULL THEN
    v_staff_supplied := array_append(v_staff_supplied, 'created_by'::text);
    v_submitted := v_submitted || jsonb_build_object('created_by', NEW.created_by);
  END IF;
  IF NEW.acknowledgment_email_sent_at IS NOT NULL THEN
    v_staff_supplied := array_append(v_staff_supplied, 'acknowledgment_email_sent_at'::text);
  END IF;
  IF NEW.confirmation_email_sent_at IS NOT NULL THEN
    v_staff_supplied := array_append(v_staff_supplied, 'confirmation_email_sent_at'::text);
  END IF;
  IF NEW.cancellation_email_sent_at IS NOT NULL THEN
    v_staff_supplied := array_append(v_staff_supplied, 'cancellation_email_sent_at'::text);
  END IF;
  IF NEW.reminder_email_sent_at IS NOT NULL THEN
    v_staff_supplied := array_append(v_staff_supplied, 'reminder_email_sent_at'::text);
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

    v_system_assigned := jsonb_build_object(
      'status', NEW.status,
      'is_invoiced', NEW.is_invoiced,
      'is_checked_in', NEW.is_checked_in,
      'is_used', NEW.is_used,
      'staff_needed', NEW.staff_needed,
      'price_eur', NULL,
      'original_price_eur', NULL,
      'pricing_details', NULL,
      'discount_code_id', NULL,
      'discount_type', NULL,
      'discount_value', NULL,
      'discount_reason', NULL,
      'internal_notes', NULL,
      'staff_notes', NULL,
      'created_by', NULL
    );
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

  -- Existing pricing-trust audit entry (shape unchanged).
  IF v_trusted OR COALESCE(array_length(v_supplied, 1), 0) > 0 THEN
    PERFORM public.log_reservation_pricing_decision(
      NEW.tenant_id,
      NEW.id,
      v_trusted,
      v_role,
      current_user::text,
      CASE WHEN v_trusted THEN v_supplied ELSE ARRAY[]::text[] END,
      CASE WHEN v_trusted THEN ARRAY[]::text[] ELSE v_supplied END,
      v_submitted
    );
  END IF;

  -- Every non-authenticated booking submission is recorded, including the
  -- system-assigned field values, so it can be reviewed later.
  PERFORM public.log_booking_submission(
    NEW.tenant_id,
    NEW.id,
    v_trusted,
    v_role,
    current_user::text,
    v_system_assigned,
    CASE WHEN v_trusted THEN ARRAY[]::text[] ELSE v_supplied || v_staff_supplied END,
    v_submitted
  );

  RETURN NEW;
END;
$function$;