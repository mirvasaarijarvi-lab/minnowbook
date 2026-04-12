
-- Staff need basic SELECT on tenants for FK joins and tenant info
-- The tenants_safe view masks sensitive billing columns
CREATE POLICY "Tenant members can view own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (id = get_user_tenant_id(auth.uid()));
