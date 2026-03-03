
-- Add platform-level discount fields to tenants table
ALTER TABLE public.tenants
  ADD COLUMN discount_percentage numeric DEFAULT 0,
  ADD COLUMN discount_reason text,
  ADD COLUMN discount_granted_by uuid;
