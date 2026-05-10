
DROP POLICY IF EXISTS "Owners can add tenant users" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners can update other tenant users" ON public.tenant_users;

CREATE POLICY "Owners can add tenant users"
ON public.tenant_users
FOR INSERT
TO authenticated
WITH CHECK (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  AND user_id <> auth.uid()
  AND role = ANY (ARRAY['staff'::app_role, 'admin'::app_role])
);

CREATE POLICY "Owners can update other tenant users"
ON public.tenant_users
FOR UPDATE
TO authenticated
USING (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  AND user_id <> auth.uid()
)
WITH CHECK (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
  AND user_id <> auth.uid()
  AND role = ANY (ARRAY['staff'::app_role, 'admin'::app_role])
);
