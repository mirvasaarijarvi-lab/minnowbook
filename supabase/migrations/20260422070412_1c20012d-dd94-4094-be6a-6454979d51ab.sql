-- Create a NEW private bucket for tenant-internal sensitive files (offer PDFs, etc.)
-- The existing 'tenant-assets' bucket remains PUBLIC for logos, gallery images, and email assets.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-private', 'tenant-private', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- RLS policies on storage.objects for the 'tenant-private' bucket.
-- File path convention: '{tenant_id}/...' (tenant_id is the first folder segment).
-- Authorization: caller must be a member of that tenant (any role).

-- Drop any prior policies for this bucket (idempotent re-runs)
DROP POLICY IF EXISTS "tenant-private: members can read own tenant files" ON storage.objects;
DROP POLICY IF EXISTS "tenant-private: members can upload to own tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-private: members can update own tenant files" ON storage.objects;
DROP POLICY IF EXISTS "tenant-private: members can delete own tenant files" ON storage.objects;
DROP POLICY IF EXISTS "tenant-private: service_role full access" ON storage.objects;

-- SELECT: tenant members can read files under their tenant folder; system admins can read any
CREATE POLICY "tenant-private: members can read own tenant files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );

-- INSERT: tenant members can upload to their own tenant folder
CREATE POLICY "tenant-private: members can upload to own tenant"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );

-- UPDATE: tenant members can update files in their own tenant folder
CREATE POLICY "tenant-private: members can update own tenant files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );

-- DELETE: tenant members can delete files in their own tenant folder
CREATE POLICY "tenant-private: members can delete own tenant files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );

-- Tighten the existing 'tenant-assets' (PUBLIC) bucket: add tenant-scoped write policies
-- so anonymous users cannot write/modify, and only tenant members can write under their own folder.
DROP POLICY IF EXISTS "tenant-assets: members can upload to own tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: members can update own tenant files" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: members can delete own tenant files" ON storage.objects;

CREATE POLICY "tenant-assets: members can upload to own tenant"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] = 'email-assets'
        AND public.is_system_admin(auth.uid())
      )
      OR (
        (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );

CREATE POLICY "tenant-assets: members can update own tenant files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );

CREATE POLICY "tenant-assets: members can delete own tenant files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
    )
  );