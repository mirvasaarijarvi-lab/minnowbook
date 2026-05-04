-- Add linked_group_id so multiple reservations can be grouped together without requiring an offer
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS linked_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_reservations_linked_group_id
ON public.reservations(linked_group_id)
WHERE linked_group_id IS NOT NULL;

COMMENT ON COLUMN public.reservations.linked_group_id IS
'Groups multiple cross-type reservations created together (e.g. hotel + restaurant for the same guest), independent of any offer.';