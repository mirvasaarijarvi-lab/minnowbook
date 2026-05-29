ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ical_feed_token text UNIQUE;

-- Backfill a random token for existing tenants so admins can rotate later
UPDATE public.tenants
SET ical_feed_token = encode(gen_random_bytes(32), 'hex')
WHERE ical_feed_token IS NULL;