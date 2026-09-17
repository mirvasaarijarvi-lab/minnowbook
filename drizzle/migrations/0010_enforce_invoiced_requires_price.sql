-- Server-side guard: a reservation can only be marked invoiced when it
-- actually carries an amount (its own, or one held by a linked sibling in the
-- same bundle). Until now this was only blocked in the dashboard UI, so a
-- direct API call could flag an unpriced or tampered booking as invoiced and
-- pollute revenue reports. The message matches the one staff already see.
CREATE OR REPLACE FUNCTION public.enforce_invoiced_requires_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sibling_price numeric;
BEGIN
  IF COALESCE(NEW.is_invoiced, false) = false THEN
    RETURN NEW;
  END IF;

  -- Only validate transitions into the invoiced state, so unrelated updates on
  -- already invoiced rows are never blocked.
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_invoiced, false) = true THEN
    RETURN NEW;
  END IF;

  IF NEW.price_eur IS NOT NULL
     AND NEW.price_eur <> 'NaN'::numeric
     AND NEW.price_eur > 0 THEN
    RETURN NEW;
  END IF;

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
END;
$$;

-- Runs after sanitize_reservation_pricing (alphabetical BEFORE trigger order)
-- so a tampered pricing payload that gets cleared is judged on the values that
-- will actually be stored.
DROP TRIGGER IF EXISTS zz_enforce_invoiced_requires_price ON public.reservations;
CREATE TRIGGER zz_enforce_invoiced_requires_price
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.enforce_invoiced_requires_price();