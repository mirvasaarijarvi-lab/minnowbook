-- 1. Tenant-scoped overload of has_permission.
--    Mirrors the 2-arg version but requires every authorization path
--    (system admin bypass aside) to be scoped to p_tenant_id, closing
--    the cross-tenant owner-shortcut hole flagged by the security scan.
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id uuid,
  p_permission text,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    is_system_admin(p_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = p_user_id
        AND tenant_id = p_tenant_id
        AND (role = 'owner' OR role = 'superadmin')
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      JOIN public.role_permissions rp
        ON rp.tenant_id = tu.tenant_id
        AND rp.role_key = COALESCE(tu.custom_role_key, tu.role::text)
      WHERE tu.user_id = p_user_id
        AND tu.tenant_id = p_tenant_id
        AND rp.permission = p_permission
    );
$function$;

-- Lock down execution: only authenticated callers, never anon/public.
REVOKE ALL ON FUNCTION public.has_permission(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid) TO authenticated;

-- 2. Replace the booking_validation_log INSERT policy to use the
--    tenant-scoped overload against the row's own tenant_id.
DROP POLICY IF EXISTS "Reservation creators can insert validation log"
  ON public.booking_validation_log;

CREATE POLICY "Reservation creators can insert validation log"
ON public.booking_validation_log
FOR INSERT
TO authenticated
WITH CHECK (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND has_permission(auth.uid(), 'reservations.create', tenant_id)
);