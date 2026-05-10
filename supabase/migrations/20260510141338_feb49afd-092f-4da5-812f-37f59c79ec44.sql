
-- Replace INSERT/UPDATE policies on tenant-assets with stricter
-- prefix-whitelist versions. SELECT (read) policies are unchanged
-- because public booking pages and emails still rely on the bucket's
-- public URLs for branding assets.

DROP POLICY IF EXISTS "tenant-assets: tenant-scoped insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: tenant-scoped update write" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: members can update own tenant files" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: members can delete own tenant files" ON storage.objects;

-- Helper expression (inline): returns true when `name` is an allowed
-- branding/booking path for the caller's tenant, OR a system-admin path.
-- Using inline checks (rather than a SQL function) keeps the policy
-- self-contained and easy to audit.

CREATE POLICY "tenant-assets: branding-only insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets' AND (
      -- System admins may write to the shared email-assets/ folder.
      (
        public.is_system_admin(auth.uid())
        AND (storage.foldername(name))[1] = 'email-assets'
      )
      OR (
        -- Tenant members may only write to whitelisted branding paths
        -- inside their own tenant folder.
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
        AND (
          -- Top-level branding files: <tenant>/logo.<ext>, <tenant>/hero.<ext>
          name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
          OR
          -- Branding/booking subfolders
          (storage.foldername(name))[2] IN ('logo', 'hero', 'avatars', 'resources')
        )
      )
      OR public.is_system_admin(auth.uid())
    )
  );

CREATE POLICY "tenant-assets: branding-only update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets' AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-assets' AND (
      (
        public.is_system_admin(auth.uid())
        AND (storage.foldername(name))[1] = 'email-assets'
      )
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
        AND (
          name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]{1,8}$')
          OR (storage.foldername(name))[2] IN ('logo', 'hero', 'avatars', 'resources')
        )
      )
      OR public.is_system_admin(auth.uid())
    )
  );

CREATE POLICY "tenant-assets: tenant-scoped delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets' AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );
