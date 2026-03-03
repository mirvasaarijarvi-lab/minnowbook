ALTER TABLE public.tenant_settings
ADD COLUMN resource_type_descriptions jsonb DEFAULT '{}'::jsonb;