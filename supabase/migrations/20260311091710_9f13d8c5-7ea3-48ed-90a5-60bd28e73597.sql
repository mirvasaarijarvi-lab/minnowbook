ALTER TABLE public.resources
  ADD COLUMN offers_table_reservation boolean NOT NULL DEFAULT true,
  ADD COLUMN offers_quote boolean NOT NULL DEFAULT true,
  ADD COLUMN offers_set_menu boolean NOT NULL DEFAULT true;