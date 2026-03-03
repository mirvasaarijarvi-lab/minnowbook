
-- Remove the redundant site_type column from sites table
-- Resource types are already defined per-resource in the resources table
ALTER TABLE public.sites DROP COLUMN site_type;
