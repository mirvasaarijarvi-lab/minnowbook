-- Defence in depth: even trusted (service_role) inserts can carry malformed
-- pricing/discount payloads (NaN, Infinity, 500% discounts, a discount value
-- with no type, a promo code from another tenant, gross below final).
-- Existing CHECK constraints do not catch these, so normalise them here for
-- every context. Valid payloads are left untouched.
CREATE OR REPLACE FUNCTION public.sanitize_reservation_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_code_tenant uuid;
  v_has_discount_payload boolean;
  v_valid_discount boolean;
BEGIN
  -- 1. Non-finite numerics (NaN / +-Infinity pass the >= 0 CHECKs) are dropped.
  IF NEW.price_eur IS NOT NULL
     AND (NEW.price_eur = 'NaN'::numeric OR abs(NEW.price_eur) = 'Infinity'::numeric) THEN
    NEW.price_eur := NULL;
  END IF;
  IF NEW.original_price_eur IS NOT NULL
     AND (NEW.original_price_eur = 'NaN'::numeric OR abs(NEW.original_price_eur) = 'Infinity'::numeric) THEN
    NEW.original_price_eur := NULL;
  END IF;
  IF NEW.stall_fee IS NOT NULL
     AND (NEW.stall_fee = 'NaN'::numeric OR abs(NEW.stall_fee) = 'Infinity'::numeric) THEN
    NEW.stall_fee := NULL;
  END IF;
  IF NEW.discount_value IS NOT NULL
     AND (NEW.discount_value = 'NaN'::numeric OR abs(NEW.discount_value) = 'Infinity'::numeric) THEN
    NEW.discount_value := NULL;
  END IF;

  -- 2. A promo code must belong to the same tenant as the reservation.
  IF NEW.discount_code_id IS NOT NULL THEN
    SELECT tenant_id INTO v_code_tenant
    FROM public.discount_codes
    WHERE id = NEW.discount_code_id;
    IF v_code_tenant IS NULL OR v_code_tenant IS DISTINCT FROM NEW.tenant_id THEN
      NEW.discount_code_id := NULL;
    END IF;
  END IF;

  -- 3. Discount metadata must be complete and internally consistent.
  v_has_discount_payload :=
    NEW.discount_type IS NOT NULL
    OR NEW.discount_value IS NOT NULL
    OR NEW.discount_code_id IS NOT NULL
    OR NEW.discount_reason IS NOT NULL;

  v_valid_discount :=
    NEW.discount_type IS NOT NULL
    AND NEW.discount_value IS NOT NULL
    AND NEW.discount_value > 0
    AND (NEW.discount_type <> 'percentage' OR NEW.discount_value <= 100)
    AND (
      NEW.discount_type <> 'fixed'
      OR NEW.original_price_eur IS NULL
      OR NEW.discount_value <= NEW.original_price_eur
    );

  IF v_has_discount_payload AND NOT v_valid_discount THEN
    NEW.discount_type    := NULL;
    NEW.discount_value   := NULL;
    NEW.discount_code_id := NULL;
    NEW.discount_reason  := NULL;
    -- No usable discount: the guest owes the gross amount, never a value
    -- derived from the malformed payload.
    IF NEW.original_price_eur IS NOT NULL THEN
      NEW.price_eur := NEW.original_price_eur;
    END IF;
  END IF;

  -- 4. Gross can never be lower than the final amount.
  IF NEW.price_eur IS NOT NULL
     AND NEW.original_price_eur IS NOT NULL
     AND NEW.original_price_eur < NEW.price_eur THEN
    NEW.original_price_eur := NEW.price_eur;
  END IF;

  RETURN NEW;
END;
$function$;

-- Named so it fires after trg_validate_public_reservation_insert.
DROP TRIGGER IF EXISTS trg_zz_sanitize_reservation_pricing ON public.reservations;
CREATE TRIGGER trg_zz_sanitize_reservation_pricing
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.sanitize_reservation_pricing();