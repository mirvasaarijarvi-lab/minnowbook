-- Add free sample period columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN sample_start_date date DEFAULT NULL,
  ADD COLUMN sample_end_date date DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.tenants.sample_start_date IS 'Start date of the free sample/beta period (NULL = no sample)';
COMMENT ON COLUMN public.tenants.sample_end_date IS 'End date of the free sample/beta period (NULL = no sample)';