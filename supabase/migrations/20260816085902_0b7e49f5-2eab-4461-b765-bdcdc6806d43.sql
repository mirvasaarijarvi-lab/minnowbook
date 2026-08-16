ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS weekly_report_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_report_weekday integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS weekly_report_recipients text[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_weekly_report_weekday_check'
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_weekly_report_weekday_check
      CHECK (weekly_report_weekday BETWEEN 0 AND 6);
  END IF;
END $$;