-- Add unique constraint to prevent multiple reviews per reservation
ALTER TABLE public.guest_reviews
ADD CONSTRAINT guest_reviews_reservation_id_unique UNIQUE (reservation_id);