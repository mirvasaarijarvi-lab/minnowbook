-- discount_code_id -> discount_codes(id): SET NULL keeps the reservation's
-- frozen price snapshot when a discount code is deleted.
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_discount_code_id_fkey
  FOREIGN KEY (discount_code_id)
  REFERENCES public.discount_codes(id)
  ON DELETE SET NULL;

-- Supporting indexes for FK columns (tenant_id already covered).
CREATE INDEX IF NOT EXISTS idx_reservations_site_id
  ON public.reservations(site_id) WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_discount_code_id
  ON public.reservations(discount_code_id) WHERE discount_code_id IS NOT NULL;