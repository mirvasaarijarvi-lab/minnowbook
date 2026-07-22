-- Fix SUPA_security_definer_view ERROR on public.tenants_public.
--
-- The view was previously set to security_invoker=off as a workaround
-- because the anon SELECT policy on public.tenants had been dropped, and
-- without it the public booking pages could not resolve a tenant by slug
-- through the view. security_invoker=off makes the view execute as its
-- owner (postgres), bypassing RLS — that is what the security linter
-- flags as an Error-level finding.
--
-- Proper fix: give anon a narrow, explicit read path on the base table
-- (only active tenants, only the 5 safe columns already exposed by the
-- view), then flip the view back to security_invoker=on so it obeys RLS
-- as the calling role.

-- 1. Restore the anon RLS policy that scopes reads to active tenants only.
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;
CREATE POLICY "Public can view active tenants"
  ON public.tenants
  FOR SELECT
  TO anon
  USING (is_active = true);

-- 2. Grant anon column-level SELECT ONLY on the fields the public view
--    already exposes. All other columns on public.tenants (billing,
--    tier, contact details, feature flags, …) remain unreadable to anon
--    even if a future query targets the base table directly.
GRANT SELECT (id, name, slug, is_active, allowed_reservation_types)
  ON public.tenants TO anon;

-- 3. Also restore authenticated column-level SELECT on the same safe
--    columns, so signed-in users hitting tenants_public still resolve
--    tenants they are not a member of (e.g. discovery pages). Their
--    existing owner/admin policy continues to grant full-row access to
--    their own tenant.
DROP POLICY IF EXISTS "Authenticated can view active tenants (safe cols)" ON public.tenants;
CREATE POLICY "Authenticated can view active tenants (safe cols)"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (is_active = true);

GRANT SELECT (id, name, slug, is_active, allowed_reservation_types)
  ON public.tenants TO authenticated;

-- 4. Flip the view back to security_invoker=on so RLS is enforced as
--    the caller (anon or authenticated), not bypassed as the owner.
ALTER VIEW public.tenants_public SET (security_invoker = on);

-- 5. Re-affirm the view-level grants (idempotent).
GRANT SELECT ON public.tenants_public TO anon, authenticated;