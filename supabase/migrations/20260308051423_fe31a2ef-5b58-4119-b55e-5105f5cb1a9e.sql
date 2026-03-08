ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS offers_catering boolean NOT NULL DEFAULT false;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS offers_popup boolean NOT NULL DEFAULT false;