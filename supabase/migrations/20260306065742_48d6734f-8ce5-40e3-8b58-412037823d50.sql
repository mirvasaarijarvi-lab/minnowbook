
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS room_type text,
  ADD COLUMN IF NOT EXISTS bed_configuration jsonb,
  ADD COLUMN IF NOT EXISTS room_description text;

COMMENT ON COLUMN public.resources.room_type IS 'Room type for hotel/guesthouse: single, double, twin, double_double, triple, quad, studio, suite, connecting, entire';
COMMENT ON COLUMN public.resources.bed_configuration IS 'JSON object mapping bed type to count, e.g. {"twin_single": 2, "queen": 1}';
COMMENT ON COLUMN public.resources.room_description IS 'Free text description for suite/connecting/entire room types';
