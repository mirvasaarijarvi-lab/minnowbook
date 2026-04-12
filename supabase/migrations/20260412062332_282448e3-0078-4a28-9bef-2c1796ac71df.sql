
-- Remove the overly restrictive policy since we have the broader one
DROP POLICY IF EXISTS "Owners/admins can view full tenant" ON public.tenants;
DROP POLICY IF EXISTS "Owners admins can view own tenant" ON public.tenants;
