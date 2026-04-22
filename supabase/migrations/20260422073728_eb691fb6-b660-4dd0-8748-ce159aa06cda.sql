-- Tenant-scoped INSERT/UPDATE policies for tenant-assets bucket.
-- Ensures uploads/overwrites are restricted to authenticated tenant members
-- (or system admins). Public reads are unaffected.

-- Drop any prior versions to keep migration idempotent
DROP POLICY IF EXISTS "tenant-assets: tenant-scoped insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: tenant-scoped update write" ON storage.objects;

-- INSERT: only system admins or members of the owning tenant
-- (folder structure: <tenant_id>/...). The email-assets/ path is reserved
-- for system admins only (shared, non-tenant assets).
CREATE POLICY "tenant-assets: tenant-scoped insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets' AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );

-- UPDATE (write side): only system admins or tenant members for their own folder.
-- This complements the existing SELECT/UPDATE-using policies that gate visibility.
CREATE POLICY "tenant-assets: tenant-scoped update write"
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
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );