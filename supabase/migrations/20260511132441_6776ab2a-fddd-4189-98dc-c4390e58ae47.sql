-- Replace broad staff-level DELETE with a path-restricted version (logo/hero/avatars/resources only).
-- Owners/admins retain broader delete via the separate "Owners/admins can delete tenant assets" policy.
DROP POLICY IF EXISTS "tenant-assets: tenant-scoped delete" ON storage.objects;

CREATE POLICY "tenant-assets: branding-only delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (
    is_system_admin(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND (storage.foldername(name))[1] !~ '^email-assets$'
      AND ((storage.foldername(name))[1])::uuid = get_user_tenant_id(auth.uid())
      AND (
        name ~ (('^' || (storage.foldername(name))[1]) || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
        OR (storage.foldername(name))[2] = ANY (ARRAY['logo','hero','avatars','resources'])
      )
    )
  )
);

-- Tighten staff UPDATE so the targeted (existing) row must also be in an allowed branding path.
DROP POLICY IF EXISTS "tenant-assets: branding-only update" ON storage.objects;

CREATE POLICY "tenant-assets: branding-only update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (
    is_system_admin(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND (storage.foldername(name))[1] !~ '^email-assets$'
      AND ((storage.foldername(name))[1])::uuid = get_user_tenant_id(auth.uid())
      AND (
        name ~ (('^' || (storage.foldername(name))[1]) || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
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
      AND ((storage.foldername(name))[1])::uuid = get_user_tenant_id(auth.uid())
      AND (
        name ~ (('^' || (storage.foldername(name))[1]) || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
        OR (storage.foldername(name))[2] = ANY (ARRAY['logo','hero','avatars','resources'])
      )
    )
    OR is_system_admin(auth.uid())
  )
);