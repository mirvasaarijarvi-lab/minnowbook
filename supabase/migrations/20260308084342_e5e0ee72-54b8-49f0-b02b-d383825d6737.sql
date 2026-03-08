
-- 1. Remove public SELECT policy on discount_codes (codes validated server-side in edge function)
DROP POLICY IF EXISTS "Public can view active discount codes" ON public.discount_codes;

-- 2. Scope blocked_slots public policy by requiring tenant_id filter
DROP POLICY IF EXISTS "Public can view blocked slots for booking" ON public.blocked_slots;
CREATE POLICY "Public can view blocked slots for booking"
  ON public.blocked_slots FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = blocked_slots.tenant_id AND t.is_active = true
    )
  );

-- 3. Scope recurring_blocked_slots public policy by tenant
DROP POLICY IF EXISTS "Public can view recurring blocked slots for booking" ON public.recurring_blocked_slots;
CREATE POLICY "Public can view recurring blocked slots for booking"
  ON public.recurring_blocked_slots FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = recurring_blocked_slots.tenant_id AND t.is_active = true
    )
  );

-- 4. Scope tenant_opening_hours public policy by tenant
DROP POLICY IF EXISTS "Public can view opening hours for booking" ON public.tenant_opening_hours;
CREATE POLICY "Public can view opening hours for booking"
  ON public.tenant_opening_hours FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = tenant_opening_hours.tenant_id AND t.is_active = true
    )
  );

-- 5. Scope resource_opening_hours public policy by tenant
DROP POLICY IF EXISTS "Public can view resource opening hours" ON public.resource_opening_hours;
CREATE POLICY "Public can view resource opening hours"
  ON public.resource_opening_hours FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = resource_opening_hours.tenant_id AND t.is_active = true
    )
  );
