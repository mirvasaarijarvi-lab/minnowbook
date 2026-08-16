ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS ops_digest_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ops_digest_recipients text[] NOT NULL DEFAULT '{}'::text[];