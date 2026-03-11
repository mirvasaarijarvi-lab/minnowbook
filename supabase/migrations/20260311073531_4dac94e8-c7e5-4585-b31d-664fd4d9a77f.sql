-- Fix: login_history policy uses 2-arg has_tenant_role which checks ANY tenant
-- A user who is staff in Tenant A but owner in Tenant B could read Tenant A's login history
DROP POLICY IF EXISTS "Owners/admins can view tenant login history" ON public.login_history;

CREATE POLICY "Owners/admins can view tenant login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (
    has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
  )
);

-- Fix: support_requests SELECT policy lets all staff read all requests in tenant
-- Staff should only see their own; owners/admins see all
DROP POLICY IF EXISTS "Users can view their tenant support requests" ON public.support_requests;

CREATE POLICY "Users can view own support requests"
ON public.support_requests
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (user_id = auth.uid())
);

CREATE POLICY "Owners/admins can view all tenant support requests"
ON public.support_requests
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (
    has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
  )
);