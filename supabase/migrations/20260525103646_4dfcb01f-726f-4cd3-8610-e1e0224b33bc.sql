-- Re-grant EXECUTE to anon for SECURITY DEFINER functions that are called
-- transitively from RLS policies evaluated under the anon role, or directly
-- by the public/anon test surface. Without these, anon SELECTs on tables
-- whose policies reference is_system_admin() fail with "permission denied".

GRANT EXECUTE ON FUNCTION public.is_system_admin(uuid)            TO anon;
GRANT EXECUTE ON FUNCTION public.is_user_tenant_member(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, public.app_role, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid)  TO anon;
GRANT EXECUTE ON FUNCTION public.list_tenant_scoped_tables()       TO anon;