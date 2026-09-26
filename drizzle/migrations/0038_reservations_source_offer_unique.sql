ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS source_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.archived_reservations ADD COLUMN IF NOT EXISTS source_offer_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_source_offer_id_unique ON public.reservations(source_offer_id) WHERE source_offer_id IS NOT NULL;
COMMENT ON COLUMN public.reservations.source_offer_id IS 'Offer whose Confirm created or claimed this main reservation; unique so repeated or simultaneous confirms cannot create duplicates.';