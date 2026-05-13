DROP POLICY IF EXISTS "Public can view opening hours for booking" ON public.tenant_opening_hours;

CREATE POLICY "Public can view opening hours for booking"
ON public.tenant_opening_hours
FOR SELECT
TO anon
USING (public.is_tenant_active(tenant_id));

GRANT EXECUTE ON FUNCTION public.is_tenant_active(uuid) TO anon, authenticated;