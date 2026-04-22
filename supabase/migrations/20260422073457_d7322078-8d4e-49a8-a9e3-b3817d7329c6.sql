-- Add tenant-scoped SELECT policy for tenant-assets (defense-in-depth).
-- The bucket is currently public, so public reads bypass RLS for unauthenticated users
-- (necessary for booking-page logos, hero images, resource gallery, and email assets).
-- This SELECT policy still applies to authenticated callers and provides tenant-scoped
-- protection if the bucket is ever flipped to private.
DROP POLICY IF EXISTS "tenant-assets: tenant-scoped read" ON storage.objects;
CREATE POLICY "tenant-assets: tenant-scoped read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      -- public asset paths remain readable by any authenticated user (matches current public-bucket behavior)
      OR (storage.foldername(name))[1] = 'email-assets'
      -- tenant members can read files under their own tenant folder
      OR (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      -- approved guests with an active access-code redemption can read the granting tenant's files
      OR EXISTS (
        SELECT 1
        FROM public.access_code_redemptions r
        WHERE r.redeemed_by = auth.uid()
          AND r.is_active = true
          AND r.revoked_at IS NULL
          AND r.granted_until >= CURRENT_DATE
          AND r.tenant_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Also tighten UPDATE so approved guests cannot modify tenant files (read-only access).
-- Re-create with the same tenant-member rule (unchanged behavior for tenant members + system admins).
DROP POLICY IF EXISTS "tenant-assets: members can update own tenant files" ON storage.objects;
CREATE POLICY "tenant-assets: members can update own tenant files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
    )
  );