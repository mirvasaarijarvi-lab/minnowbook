CREATE OR REPLACE FUNCTION public.validate_public_reservation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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