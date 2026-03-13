-- Fix 1: Add WITH CHECK to notifications UPDATE policy to prevent tenant reassignment
DROP POLICY IF EXISTS "Tenant members can update notifications" ON public.notifications;
CREATE POLICY "Tenant members can update notifications"
ON public.notifications
FOR UPDATE
TO public
USING (tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Fix 2: Restrict public resource visibility to approved resources only
DROP POLICY IF EXISTS "Public can view active resources for booking" ON public.resources;
CREATE POLICY "Public can view active resources for booking"
ON public.resources
FOR SELECT
TO anon
USING ((is_active = true) AND (approval_status = 'approved'));