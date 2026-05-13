-- Remove anon SELECT policy on base tenants table
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;

-- Ensure anon cannot read the base table at all
REVOKE SELECT ON public.tenants FROM anon;

-- Ensure the safe public view is readable by anon and authenticated
GRANT SELECT ON public.tenants_public TO anon, authenticated;