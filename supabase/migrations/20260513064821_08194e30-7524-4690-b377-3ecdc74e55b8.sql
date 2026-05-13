-- Revoke SELECT on sensitive tenants columns from anonymous role.
-- The "Public can view active tenants" RLS policy still allows row visibility
-- (needed for slug-based booking page resolution and for EXISTS subqueries
-- in other tables' anon policies), but column-level grants now hide the
-- billing/billing-adjacent columns from anon entirely.
REVOKE SELECT ON public.tenants FROM anon;

GRANT SELECT (
  id,
  name,
  slug,
  allowed_reservation_types,
  is_active,
  created_at,
  updated_at
) ON public.tenants TO anon;
