CREATE OR REPLACE FUNCTION public.log_reservation_pricing_decision(
  p_tenant_id uuid,
  p_reservation_id uuid,
  p_trusted boolean,
  p_jwt_role text,
  p_db_user text,
  p_kept text[],
  p_scrubbed text[],
  p_submitted jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    'pricing_trust_decision',
    CASE
      WHEN p_trusted THEN
        'Trusted insert: kept pricing fields ' ||
        COALESCE(nullif(array_to_string(p_kept, ', '), ''), '(none)')
      ELSE
        'Untrusted insert: scrubbed pricing fields ' ||
        COALESCE(nullif(array_to_string(p_scrubbed, ', '), ''), '(none)')
    END,
    NULL,
    jsonb_build_object(
      'trusted', p_trusted,
      'jwt_role', p_jwt_role,
      'db_user', p_db_user,
      'kept_fields', COALESCE(to_jsonb(p_kept), '[]'::jsonb),
      'scrubbed_fields', COALESCE(to_jsonb(p_scrubbed), '[]'::jsonb),
      'submitted_values', COALESCE(p_submitted, '{}'::jsonb)
    )
  );
EXCEPTION WHEN others THEN
  RETURN;
END;
$function$;

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
  v_supplied text[] := ARRAY[]::text[];
  v_submitted jsonb := '{}'::jsonb;
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

  RETURN NEW;
END;
$function$;