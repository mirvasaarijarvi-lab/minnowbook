ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_by_name text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_reservation_id uuid,
  ADD COLUMN IF NOT EXISTS reservation_created_at timestamptz;

COMMENT ON COLUMN public.offers.confirmed_by IS 'Audit: user whose confirm created/claimed the reservation. Set by trigger only, write-once.';
COMMENT ON COLUMN public.offers.confirmed_at IS 'Audit: when the reservation was linked to this offer. Set by trigger only, write-once.';
COMMENT ON COLUMN public.offers.reservation_created_at IS 'Audit: created_at of the linked reservation (original booking time when an existing booking was reused).';

-- Records the audit when a reservation gets linked to an offer. Runs as the
-- confirming user's transaction, so the winning confirm is the one recorded.
CREATE OR REPLACE FUNCTION public.record_offer_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text;
BEGIN
  IF NEW.source_offer_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.source_offer_id IS NOT DISTINCT FROM NEW.source_offer_id THEN
    RETURN NEW;
  END IF;
  IF _uid IS NOT NULL THEN
    SELECT tu.display_name INTO _name
      FROM public.tenant_users tu
     WHERE tu.user_id = _uid AND tu.tenant_id = NEW.tenant_id
     LIMIT 1;
  END IF;
  PERFORM set_config('app.offer_confirm_audit', 'on', true);
  UPDATE public.offers o
     SET confirmed_by = _uid,
         confirmed_by_name = _name,
         confirmed_at = now(),
         confirmed_reservation_id = NEW.id,
         reservation_created_at = NEW.created_at
   WHERE o.id = NEW.source_offer_id
     AND o.tenant_id = NEW.tenant_id
     AND o.confirmed_at IS NULL;
  PERFORM set_config('app.offer_confirm_audit', 'off', true);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_offer_confirmation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_record_offer_confirmation ON public.reservations;
CREATE TRIGGER trg_record_offer_confirmation
AFTER INSERT OR UPDATE OF source_offer_id ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.record_offer_confirmation();

-- Audit columns are write-once and only writable by the trigger above.
CREATE OR REPLACE FUNCTION public.guard_offer_confirmation_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('app.offer_confirm_audit', true), 'off') = 'on'
     AND OLD.confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.confirmed_by := NULL;
    NEW.confirmed_by_name := NULL;
    NEW.confirmed_at := NULL;
    NEW.confirmed_reservation_id := NULL;
    NEW.reservation_created_at := NULL;
    RETURN NEW;
  END IF;
  NEW.confirmed_by := OLD.confirmed_by;
  NEW.confirmed_by_name := OLD.confirmed_by_name;
  NEW.confirmed_at := OLD.confirmed_at;
  NEW.confirmed_reservation_id := OLD.confirmed_reservation_id;
  NEW.reservation_created_at := OLD.reservation_created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_offer_confirmation_audit ON public.offers;
CREATE TRIGGER trg_guard_offer_confirmation_audit
BEFORE INSERT OR UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.guard_offer_confirmation_audit();