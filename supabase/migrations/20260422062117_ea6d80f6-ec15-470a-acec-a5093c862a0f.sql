
-- ============================================================
-- 1. Add tenant_id to email_send_log for proper tenant scoping
-- ============================================================
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_send_log_tenant ON public.email_send_log(tenant_id);

-- ============================================================
-- 2. Prevent owners from escalating/modifying their own role
-- ============================================================
-- Replace the broad "FOR ALL" owner policy with split policies that
-- allow managing other team members but never modifying one's own row
-- in a way that would change role or approval status.

DROP POLICY IF EXISTS "Owners can manage tenant users" ON public.tenant_users;

-- INSERT: owners can add new members to their own tenant, but cannot
-- create a new row for themselves (prevents role re-creation tricks).
CREATE POLICY "Owners can add tenant users"
  ON public.tenant_users FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
    AND user_id <> auth.uid()
  );

-- UPDATE: owners can update other members in their tenant.
-- They cannot update their own row (prevents self-promotion / approval tampering).
CREATE POLICY "Owners can update other tenant users"
  ON public.tenant_users FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
    AND user_id <> auth.uid()
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
    AND user_id <> auth.uid()
  );

-- DELETE: owners can remove other members from their tenant.
-- Owners cannot delete themselves through this policy.
CREATE POLICY "Owners can remove other tenant users"
  ON public.tenant_users FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
    AND user_id <> auth.uid()
  );

-- SELECT remains covered by existing "Users can view tenant users in their tenant" policy.
