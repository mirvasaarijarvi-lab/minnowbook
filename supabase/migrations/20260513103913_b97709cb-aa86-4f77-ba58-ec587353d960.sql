-- Restore the anon SELECT policy on public.tenants. The `tenants_public`
-- view runs with security_invoker=on, so the calling role (anon) needs
-- both a SELECT grant (restored in a prior migration) AND an RLS policy
-- on the underlying base table. Without the policy the public booking
-- page cannot resolve the tenant by slug and the form never renders.
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;
CREATE POLICY "Public can view active tenants"
  ON public.tenants
  FOR SELECT
  TO anon
  USING (is_active = true);