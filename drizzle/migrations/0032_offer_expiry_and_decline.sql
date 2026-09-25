ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS expires_on date;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
UPDATE public.offers SET expires_on = to_date(validity_date, 'DD.MM.YYYY')
  WHERE expires_on IS NULL AND validity_date ~ '^\d{1,2}\.\d{1,2}\.\d{4}$';
UPDATE public.offers SET accepted_at = updated_at WHERE status = 'confirmed' AND accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS offers_tenant_status_expires_idx ON public.offers(tenant_id, status, expires_on);
COMMENT ON COLUMN public.offers.expires_on IS 'Last day the offer is valid; open offers past this date show as expired.';
COMMENT ON COLUMN public.offers.status IS 'draft | sent | confirmed (accepted) | declined | expired';