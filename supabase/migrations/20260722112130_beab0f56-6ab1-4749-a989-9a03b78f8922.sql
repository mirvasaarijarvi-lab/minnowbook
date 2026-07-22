-- 1. Remove the anon and authenticated "view active tenants" policies
--    added by the previous migration. Their existence broke the RLS
--    invariant "no anon SELECT on the tenants base table".
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;
DROP POLICY IF EXISTS "Authenticated can view active tenants (safe cols)" ON public.tenants;

-- 2. Revoke the column-level GRANTs that accompanied those policies.
--    Owner/admin/system-admin policies use full-row access via their own
--    RLS policies, so no baseline column grant is needed.
REVOKE SELECT (id, name, slug, is_active, allowed_reservation_types)
  ON public.tenants FROM anon;
REVOKE SELECT (id, name, slug, is_active, allowed_reservation_types)
  ON public.tenants FROM authenticated;

-- 3. Provide the "safe columns of active tenants" projection as a
--    SECURITY DEFINER function. The function runs as its owner, so it
--    can read the tenants base table without needing an anon RLS
--    policy, but it only ever returns the 5 whitelisted columns and
--    only for is_active = true rows.
CREATE OR REPLACE FUNCTION public.get_active_tenants_public()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  is_active boolean,
  allowed_reservation_types text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, is_active, allowed_reservation_types
  FROM public.tenants
  WHERE is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_active_tenants_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_tenants_public()
  TO anon, authenticated, service_role;

-- 4. Rebuild the public view on top of that function so PostgREST
--    consumers keep the same `.from("tenants_public").select(...)`
--    surface. security_invoker=on so the linter's "definer view"
--    check stays green; the SECURITY DEFINER work is confined to the
--    helper function.
DROP VIEW IF EXISTS public.tenants_public;
CREATE VIEW public.tenants_public
WITH (security_invoker = on)
AS
SELECT id, name, slug, is_active, allowed_reservation_types
FROM public.get_active_tenants_public();

GRANT SELECT ON public.tenants_public TO anon, authenticated, service_role;