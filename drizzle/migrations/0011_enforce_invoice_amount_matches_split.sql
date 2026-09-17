-- Extend the invoicing guard: an amount can only be invoiced when it
-- reconciles exactly with the room + breakfast split the reports derive from
-- it. Rejects sub-cent amounts (which would round differently in the table,
-- CSV and PDF) and stays where the breakfast component alone exceeds the total
-- (which would make the room line negative).
CREATE OR REPLACE FUNCTION public.enforce_invoiced_requires_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sibling_price numeric;
  v_nights integer;
  v_breakfast numeric;
  v_rate numeric;
BEGIN
  IF COALESCE(NEW.is_invoiced, false) = false THEN
    RETURN NEW;
  END IF;

  -- Only validate transitions into the invoiced state, so unrelated updates on
  -- already invoiced rows are never blocked.
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_invoiced, false) = true THEN
    RETURN NEW;
  END IF;

  IF NEW.price_eur IS NULL
     OR NEW.price_eur = 'NaN'::numeric
     OR NEW.price_eur <= 0 THEN
    -- A bundle where one leg holds the package total is fine.
    IF NEW.linked_group_id IS NOT NULL THEN
      SELECT max(price_eur) INTO v_sibling_price
      FROM public.reservations
      WHERE linked_group_id = NEW.linked_group_id
        AND tenant_id = NEW.tenant_id
        AND id IS DISTINCT FROM NEW.id;
      IF v_sibling_price IS NOT NULL AND v_sibling_price > 0 THEN
        RETURN NEW;
      END IF;
    END IF;

    RAISE EXCEPTION 'Add a price before marking this reservation as invoiced.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- The amount must be a whole number of cents: the report split is computed in
  -- cents, so a sub-cent amount could never reconcile.
  IF NEW.price_eur <> round(NEW.price_eur, 2) THEN
    RAISE EXCEPTION 'Invoice amount must match the recalculated room and breakfast totals.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Accommodation with breakfast: breakfast alone may never exceed the total.
  IF NEW.reservation_type IN ('guesthouse', 'hotel')
     AND COALESCE(NEW.breakfast_included, false) = true THEN
    v_nights := GREATEST(
      COALESCE(NEW.check_out_date - NEW.date, 0),
      0
    );
    v_rate := NEW.breakfast_price_per_person;
    IF v_nights > 0 AND v_rate IS NOT NULL AND v_rate = round(v_rate, 2) AND v_rate >= 0 THEN
      v_breakfast := round(v_rate * COALESCE(NEW.guests_count, 0) * v_nights, 2);
      IF v_breakfast > NEW.price_eur THEN
        RAISE EXCEPTION 'Invoice amount must match the recalculated room and breakfast totals.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;