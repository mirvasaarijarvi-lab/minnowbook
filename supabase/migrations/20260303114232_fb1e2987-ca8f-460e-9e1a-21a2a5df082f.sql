-- Add restaurant sub-type and related fields for catering & pop-up services
ALTER TABLE public.reservations
  ADD COLUMN restaurant_sub_type text DEFAULT 'dine_in',
  ADD COLUMN delivery_address text,
  ADD COLUMN dietary_notes text,
  ADD COLUMN equipment_needed boolean DEFAULT false,
  ADD COLUMN staff_needed boolean DEFAULT false,
  ADD COLUMN festival_name text,
  ADD COLUMN stall_size text,
  ADD COLUMN electricity_needed boolean DEFAULT false,
  ADD COLUMN water_needed boolean DEFAULT false,
  ADD COLUMN food_permits text,
  ADD COLUMN stall_fee numeric;

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.restaurant_sub_type IS 'Sub-type for restaurant reservations: dine_in, catering, popup';
COMMENT ON COLUMN public.reservations.delivery_address IS 'Catering delivery/event address';
COMMENT ON COLUMN public.reservations.dietary_notes IS 'Catering dietary requirements and allergies';
COMMENT ON COLUMN public.reservations.equipment_needed IS 'Whether catering includes serving equipment';
COMMENT ON COLUMN public.reservations.staff_needed IS 'Whether catering includes serving staff';
COMMENT ON COLUMN public.reservations.festival_name IS 'Pop-up: festival or event name';
COMMENT ON COLUMN public.reservations.stall_size IS 'Pop-up: stall/space size preference';
COMMENT ON COLUMN public.reservations.electricity_needed IS 'Pop-up: needs electricity connection';
COMMENT ON COLUMN public.reservations.water_needed IS 'Pop-up: needs water connection';
COMMENT ON COLUMN public.reservations.food_permits IS 'Pop-up: food safety permits info';
COMMENT ON COLUMN public.reservations.stall_fee IS 'Pop-up: stall rental fee in EUR';