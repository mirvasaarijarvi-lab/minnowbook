
-- Add a JSONB column for custom display names per resource type
-- e.g. {"restaurant": "Ravintola Wiurila", "hotel": "Gasthaus Wiurila", "venue": "Wiurila Manor"}
ALTER TABLE public.tenant_settings
ADD COLUMN resource_type_names jsonb DEFAULT '{}'::jsonb;
