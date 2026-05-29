
-- Fix 1: Restrict the ical_feed_token (bearer secret) so it cannot be read
-- directly from the tenants table by owners/admins. Access via RPC instead.
REVOKE SELECT (ical_feed_token) ON public.tenants FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_tenant_ical_feed_token(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT (
    public.is_system_admin(auth.uid())
    OR public.has_tenant_role(auth.uid(), 'owner'::app_role, p_tenant_id)
    OR public.has_tenant_role(auth.uid(), 'admin'::app_role, p_tenant_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT ical_feed_token INTO v_token FROM public.tenants WHERE id = p_tenant_id;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_ical_feed_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_ical_feed_token(uuid) TO authenticated;

-- Fix 2: Consolidate tenant-assets storage policies so path ownership uses
-- is_user_tenant_member (multi-tenant safe) rather than the single-tenant
-- get_user_tenant_id() helper that silently returns NULL for multi-tenant users.
DROP POLICY IF EXISTS "tenant-assets: branding-only insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: branding-only update" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: branding-only delete" ON storage.objects;

CREATE POLICY "tenant-assets: branding-only insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (
    (is_system_admin(auth.uid()) AND (storage.foldername(name))[1] = 'email-assets')
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND (storage.foldername(name))[1] !~ '^email-assets$'
      AND is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      AND (
        name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
        OR (storage.foldername(name))[2] = ANY (ARRAY['logo','hero','avatars','resources'])
      )
    )
    OR is_system_admin(auth.uid())
  )
);

CREATE POLICY "tenant-assets: branding-only update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-assets'
  AND (
    is_system_admin(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND (storage.foldername(name))[1] !~ '^email-assets$'
      AND is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      AND (
        name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
        OR (storage.foldername(name))[2] = ANY (ARRAY['logo','hero','avatars','resources'])
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (
    (is_system_admin(auth.uid()) AND (storage.foldername(name))[1] = 'email-assets')
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND (storage.foldername(name))[1] !~ '^email-assets$'
      AND is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      AND (
        name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
        OR (storage.foldername(name))[2] = ANY (ARRAY['logo','hero','avatars','resources'])
      )
    )
    OR is_system_admin(auth.uid())
  )
);

CREATE POLICY "tenant-assets: branding-only delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-assets'
  AND (
    is_system_admin(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND (storage.foldername(name))[1] !~ '^email-assets$'
      AND is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      AND (
        name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
        OR (storage.foldername(name))[2] = ANY (ARRAY['logo','hero','avatars','resources'])
      )
    )
  )
);
