-- Serialize seat counting for special occasions so two simultaneous bookings
-- cannot both read the same "seats left" snapshot and oversell the occasion.
CREATE OR REPLACE FUNCTION public.enforce_special_occasion_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
  v_booking_type TEXT;
  v_taken INTEGER;
  v_guests INTEGER;
BEGIN
  IF NEW.special_occasion_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF LOWER(COALESCE(NEW.status, '')) IN ('cancelled', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT capacity, booking_type
    INTO v_capacity, v_booking_type
  FROM public.special_occasions
  WHERE id = NEW.special_occasion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_guests := GREATEST(1, COALESCE(NEW.guests_count, NEW.estimated_guests, 1));

  SELECT COALESCE(SUM(GREATEST(1, COALESCE(r.guests_count, r.estimated_guests, 1))), 0)
    INTO v_taken
  FROM public.reservations r
  WHERE r.special_occasion_id = NEW.special_occasion_id
    AND r.id IS DISTINCT FROM NEW.id
    AND LOWER(COALESCE(r.status, '')) NOT IN ('cancelled', 'rejected')
    AND (
      v_booking_type = 'open'
      OR r.start_time IS NOT DISTINCT FROM NEW.start_time
    );

  IF v_taken + v_guests > GREATEST(0, COALESCE(v_capacity, 0)) THEN
    RAISE EXCEPTION 'This special occasion is fully booked (% seat(s) left)',
      GREATEST(0, COALESCE(v_capacity, 0) - v_taken)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_special_occasion_capacity ON public.reservations;
CREATE TRIGGER trg_reservations_special_occasion_capacity
BEFORE INSERT ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.enforce_special_occasion_capacity();