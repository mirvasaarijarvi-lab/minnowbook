-- Add a generated, lowercased combined search column over the guest fields.
-- Stored generated column lets us put a single trigram GIN index over it.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_search_text text
  GENERATED ALWAYS AS (
    lower(
      coalesce(guest_name, '')  || ' ' ||
      coalesce(guest_email, '') || ' ' ||
      coalesce(guest_phone, '')
    )
  ) STORED;

-- Replace per-column trigram GINs with one index over the combined column.
CREATE INDEX IF NOT EXISTS idx_reservations_guest_search_trgm
  ON public.reservations USING GIN (guest_search_text gin_trgm_ops);

DROP INDEX IF EXISTS public.idx_reservations_guest_name_trgm;
DROP INDEX IF EXISTS public.idx_reservations_guest_email_trgm;
DROP INDEX IF EXISTS public.idx_reservations_guest_phone_trgm;