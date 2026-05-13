-- Replace EXISTS-on-tenants subqueries in anon-facing RLS policies with a
-- SECURITY DEFINER function so anon does not need any privilege on the
-- tenants base table to evaluate "is this tenant active?".

CREATE OR REPLACE FUNCTION public.is_tenant_active(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_active(uuid) TO anon, authenticated;

-- blocked_slots
DROP POLICY IF EXISTS "Public can view blocked slots for booking" ON public.blocked_slots;
CREATE POLICY "Public can view blocked slots for booking"
  ON public.blocked_slots FOR SELECT TO anon
  USING (public.is_tenant_active(tenant_id));

-- recurring_blocked_slots
DROP POLICY IF EXISTS "Public can view recurring blocked slots for booking" ON public.recurring_blocked_slots;
CREATE POLICY "Public can view recurring blocked slots for booking"
  ON public.recurring_blocked_slots FOR SELECT TO anon, authenticated
  USING (public.is_tenant_active(tenant_id));

-- resource_opening_hours
DROP POLICY IF EXISTS "Public can view resource opening hours" ON public.resource_opening_hours;
CREATE POLICY "Public can view resource opening hours"
  ON public.resource_opening_hours FOR SELECT TO anon, authenticated
  USING (public.is_tenant_active(tenant_id));

-- reservations INSERT (anon also has EXISTS on tenants here)
DROP POLICY IF EXISTS "Public can create reservations for active tenants" ON public.reservations;
CREATE POLICY "Public can create reservations for active tenants"
  ON public.reservations FOR INSERT TO anon
  WITH CHECK (public.is_tenant_active(tenant_id));