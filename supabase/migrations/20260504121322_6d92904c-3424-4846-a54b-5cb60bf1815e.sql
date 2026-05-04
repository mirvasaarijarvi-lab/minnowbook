-- Read-only self-test for Professional tier limit functions/triggers.
-- Asserts via RAISE EXCEPTION; migration fails loudly if behavior regresses.

DO $test$
DECLARE
  v_max int;
BEGIN
  -- Reservation type cap
  v_max := public.get_tier_max_reservation_types('professional');
  IF v_max <> 5 THEN
    RAISE EXCEPTION 'FAIL: Professional max reservation types should be 5, got %', v_max;
  END IF;

  -- Total resources cap (effectively unlimited)
  v_max := public.get_tier_max_resources_total('professional');
  IF v_max < 999999 THEN
    RAISE EXCEPTION 'FAIL: Professional total resources should be unlimited (>=999999), got %', v_max;
  END IF;

  -- Basic + Business regression
  IF public.get_tier_max_reservation_types('basic') <> 2 THEN
    RAISE EXCEPTION 'FAIL: Basic max reservation types should be 2';
  END IF;
  IF public.get_tier_max_resources_total('basic') <> 2 THEN
    RAISE EXCEPTION 'FAIL: Basic total resources should be 2';
  END IF;
  IF public.get_tier_max_reservation_types('business') < 999 THEN
    RAISE EXCEPTION 'FAIL: Business max reservation types should be unlimited';
  END IF;

  -- Sanity: 5-type combo including 'custom' fits within Professional cap
  IF array_length(ARRAY['restaurant','hotel','guesthouse','venue','custom']::text[], 1)
     > public.get_tier_max_reservation_types('professional') THEN
    RAISE EXCEPTION 'FAIL: 5-type combo with custom should fit Professional cap';
  END IF;

  -- 6 types must exceed Professional cap
  IF array_length(ARRAY['restaurant','hotel','guesthouse','venue','custom','popup']::text[], 1)
     <= public.get_tier_max_reservation_types('professional') THEN
    RAISE EXCEPTION 'FAIL: 6-type combo should exceed Professional cap';
  END IF;

  RAISE NOTICE 'Professional tier limit tests: ALL PASSED';
END
$test$;