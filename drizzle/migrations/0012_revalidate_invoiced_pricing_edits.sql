-- Staff edits to pricing-relevant fields must keep an invoiced booking's
-- amount reconciled with the room + breakfast lines reports derive from it.
-- Previously validation only ran on the transition into the invoiced state, so
-- a booking could be invoiced at a correct total and then edited (more guests,
-- longer stay, higher breakfast rate) into an amount that no longer reconciles.
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
  v_pricing_changed boolean := false;
BEGIN
  IF COALESCE(NEW.is_invoiced, false) = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_invoiced, false) = true THEN
    v_pricing_changed :=
      OLD.price_eur IS DISTINCT FROM NEW.price_eur
      OR OLD.breakfast_price_per_person IS DISTINCT FROM NEW.breakfast_price_per_person
      OR OLD.breakfast_included IS DISTINCT FROM NEW.breakfast_included
      OR OLD.guests_count IS DISTINCT FROM NEW.guests_count
      OR OLD.date IS DISTINCT FROM NEW.date
      OR OLD.check_out_date IS DISTINCT FROM NEW.check_out_date
      OR OLD.reservation_type IS DISTINCT FROM NEW.reservation_type;
    -- Unrelated updates on an already invoiced row are never blocked.
    IF NOT v_pricing_changed THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.price_eur IS NULL
     OR NEW.price_eur = 'NaN'::numeric
     OR NEW.price_eur <= 0 THEN
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

  IF NEW.price_eur <> round(NEW.price_eur, 2) THEN
    RAISE EXCEPTION 'Invoice amount must match the recalculated room and breakfast totals.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.reservation_type IN ('guesthouse', 'hotel')
     AND COALESCE(NEW.breakfast_included, false) = true THEN
    v_nights := GREATEST(COALESCE(NEW.check_out_date - NEW.date, 0), 0);
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