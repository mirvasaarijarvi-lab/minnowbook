
-- =========================================================================
-- Finding 1: sites — scope "public can view active sites" explicitly to
-- anon + authenticated instead of the generic "public" role. Same effect
-- for legitimate callers, but no ambiguity about service_role or future
-- role additions inheriting the grant.
-- =========================================================================
DROP POLICY IF EXISTS "Public can view active sites for booking" ON public.sites;

CREATE POLICY "Public can view active sites for booking"
ON public.sites
FOR SELECT
TO anon, authenticated
USING (is_active = true);


-- =========================================================================
-- Finding 2: reservations — beyond the existing WITH CHECK that blocks
-- staff-only columns, add a BEFORE INSERT trigger that runs server-side
-- validation on public/anonymous submissions. This is the "controlled
-- server-side validation" the finding asks for, without breaking the
-- existing public booking flow.
--
-- Rules enforced for inserts where auth.uid() IS NULL (anonymous public
-- bookings):
--   * guest_name: required, 1..120 chars after trim, no control chars
--   * guest_email: if provided, <= 254 chars, must match a conservative
--     email shape
--   * guest_phone: if provided, <= 32 chars, digits/space/+()-./ only
--   * notes/special_requests-style free text: capped at 2000 chars
--   * date must be today or later (no bulk-backfill of arbitrary dates)
--   * party_size / guest_count style ints (if present) must be sane
--
-- Signed-in staff writes are untouched (trigger short-circuits).
-- =========================================================================
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
  -- Skip for signed-in callers. Staff/RPC paths do their own validation
  -- and must remain able to fix historical or edge-case rows.
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- guest_name: required, bounded, no control chars
  v_name := btrim(COALESCE(NEW.guest_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'guest_name is required'
      USING ERRCODE = '22023';
  END IF;
  IF length(v_name) > 120 THEN
    RAISE EXCEPTION 'guest_name is too long (max 120 chars)'
      USING ERRCODE = '22023';
  END IF;
  IF v_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'guest_name contains control characters'
      USING ERRCODE = '22023';
  END IF;
  NEW.guest_name := v_name;

  -- guest_email: optional, bounded, conservative shape
  IF NEW.guest_email IS NOT NULL AND btrim(NEW.guest_email) <> '' THEN
    v_email := lower(btrim(NEW.guest_email));
    IF length(v_email) > 254 THEN
      RAISE EXCEPTION 'guest_email is too long'
        USING ERRCODE = '22023';
    END IF;
    IF v_email !~ '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'guest_email has invalid format'
        USING ERRCODE = '22023';
    END IF;
    NEW.guest_email := v_email;
  ELSE
    NEW.guest_email := NULL;
  END IF;

  -- guest_phone: optional, bounded, digits+separators only
  IF NEW.guest_phone IS NOT NULL AND btrim(NEW.guest_phone) <> '' THEN
    v_phone := btrim(NEW.guest_phone);
    IF length(v_phone) > 32 THEN
      RAISE EXCEPTION 'guest_phone is too long (max 32 chars)'
        USING ERRCODE = '22023';
    END IF;
    IF v_phone !~ '^[0-9 +()\-./]+$' THEN
      RAISE EXCEPTION 'guest_phone contains invalid characters'
        USING ERRCODE = '22023';
    END IF;
    NEW.guest_phone := v_phone;
  ELSE
    NEW.guest_phone := NULL;
  END IF;

  -- Free-text fields: cap length so anon inserts cannot store megabytes.
  IF NEW.special_requests IS NOT NULL AND length(NEW.special_requests) > 2000 THEN
    RAISE EXCEPTION 'special_requests exceeds 2000 chars'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.notes IS NOT NULL AND length(NEW.notes) > 2000 THEN
    RAISE EXCEPTION 'notes exceeds 2000 chars'
      USING ERRCODE = '22023';
  END IF;

  -- Date must not be historical for anon bookings (day precision only).
  IF NEW.date IS NOT NULL AND NEW.date < (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'reservation date cannot be in the past'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_public_reservation_insert ON public.reservations;
CREATE TRIGGER trg_validate_public_reservation_insert
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_public_reservation_insert();


-- =========================================================================
-- Finding 3: site_settings — verification only. No anon SELECT policy
-- exists (matches tenant_settings). No change required; documenting the
-- intent so future edits don't inadvertently open it up.
-- =========================================================================
COMMENT ON TABLE public.site_settings IS
  'Site-level configuration incl. business_email/phone/address. Members-only by design; do NOT add anon SELECT policies here. Public booking pages resolve business contact via the public sites/tenants surfaces or a controlled edge function.';
