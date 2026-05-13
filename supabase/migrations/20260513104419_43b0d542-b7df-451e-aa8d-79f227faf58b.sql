-- Re-lock the base tenants table from anon access. The previous fix added
-- an anon SELECT policy to make the public booking page work, but the
-- security regression test enforces that direct SELECT on public.tenants
-- by anon must return zero rows. Recreate `tenants_public` with
-- security_invoker=off so it returns rows under the view owner's
-- privileges, regardless of whether the caller has base-table access.

DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;
REVOKE SELECT ON public.tenants FROM anon;

DROP VIEW IF EXISTS public.tenants_public;
CREATE VIEW public.tenants_public
WITH (security_invoker = off) AS
  SELECT id, name, slug, is_active, allowed_reservation_types
  FROM public.tenants
  WHERE is_active = true;

GRANT SELECT ON public.tenants_public TO anon, authenticated;