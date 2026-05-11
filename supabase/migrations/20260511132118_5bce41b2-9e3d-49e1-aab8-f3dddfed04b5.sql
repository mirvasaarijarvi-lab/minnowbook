-- =====================================================================
-- Security finding remediation
-- =====================================================================
-- 1) Drop the cross-tenant 2-arg overloads of has_permission /
--    has_tenant_role. They returned true if the user held the role /
--    permission in ANY tenant, which would let an owner of Tenant A
--    pass an RLS check for Tenant B. All in-database policies and
--    application call-sites already use the 3-arg, tenant-scoped
--    versions (audited via pg_policies and a repo-wide grep), so the
--    drops are safe. Use RESTRICT to fail loudly if anything still
--    depends on them.
-- 2) Tighten the tenant-assets storage bucket. The two member-wide
--    policies (`tenant-assets members manage own tenant` ALL,
--    `tenant-assets members select`) let any approved tenant member
--    read/write/delete every path under their tenant prefix — including
--    sensitive sub-paths like `avatars/` and `resources/` — bypassing
--    the path-restricted branding-only INSERT/UPDATE policies because
--    permissive policies are OR-combined. Drop them; the existing
--    `tenant-assets: branding-only insert/update`,
--    `tenant-assets: tenant-scoped read/delete`, and
--    `Owners/admins can list/update/delete tenant assets` policies
--    keep the legitimate flows working.
-- =====================================================================

-- 1. Drop the unsafe overloads.
DROP FUNCTION IF EXISTS public.has_permission(uuid, text)  RESTRICT;
DROP FUNCTION IF EXISTS public.has_tenant_role(uuid, public.app_role) RESTRICT;

-- 2. Tighten tenant-assets storage policies.
DROP POLICY IF EXISTS "tenant-assets members manage own tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets members select"            ON storage.objects;