-- Add CHECK constraints to enforce data integrity on reservations.
-- All existing rows have been verified to satisfy these constraints.

ALTER TABLE public.reservations
  ADD CONSTRAINT chk_reservations_status
    CHECK (status IS NULL OR status IN ('pending','confirmed','cancelled')),
  ADD CONSTRAINT chk_reservations_reservation_type
    CHECK (reservation_type IN ('restaurant','guesthouse','venue','hotel','custom')),
  ADD CONSTRAINT chk_reservations_restaurant_sub_type
    CHECK (restaurant_sub_type IS NULL OR restaurant_sub_type IN ('dine_in','catering','popup')),
  ADD CONSTRAINT chk_reservations_pricing_type
    CHECK (pricing_type IS NULL OR pricing_type IN ('menu','fixed_price','quote')),
  ADD CONSTRAINT chk_reservations_discount_type
    CHECK (discount_type IS NULL OR discount_type IN ('percentage','fixed','free')),
  ADD CONSTRAINT chk_reservations_end_after_start
    CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time),
  ADD CONSTRAINT chk_reservations_check_out_after_date
    CHECK (check_out_date IS NULL OR check_out_date >= date),
  ADD CONSTRAINT chk_reservations_guests_count_positive
    CHECK (guests_count IS NULL OR guests_count > 0),
  ADD CONSTRAINT chk_reservations_estimated_guests_positive
    CHECK (estimated_guests IS NULL OR estimated_guests > 0),
  ADD CONSTRAINT chk_reservations_price_eur_nonneg
    CHECK (price_eur IS NULL OR price_eur >= 0),
  ADD CONSTRAINT chk_reservations_original_price_eur_nonneg
    CHECK (original_price_eur IS NULL OR original_price_eur >= 0),
  ADD CONSTRAINT chk_reservations_breakfast_price_nonneg
    CHECK (breakfast_price_per_person IS NULL OR breakfast_price_per_person >= 0),
  ADD CONSTRAINT chk_reservations_stall_fee_nonneg
    CHECK (stall_fee IS NULL OR stall_fee >= 0),
  ADD CONSTRAINT chk_reservations_discount_value_nonneg
    CHECK (discount_value IS NULL OR discount_value >= 0),
  ADD CONSTRAINT chk_reservations_guest_email_format
    CHECK (guest_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT chk_reservations_language_format
    CHECK (language IS NULL OR (char_length(language) BETWEEN 2 AND 5));