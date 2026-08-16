ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS guest_request_alerts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guest_request_alert_recipients text[] NOT NULL DEFAULT '{}'::text[];