
-- Remove the broad SELECT policy on storage.objects for tenant-assets.
-- The bucket remains public for direct-URL access (serving images), but
-- listing the bucket contents is no longer allowed. Owners/admins can
-- still manage their own files via the existing INSERT/UPDATE/DELETE
-- policies.
DROP POLICY IF EXISTS "Public can view tenant assets" ON storage.objects;

-- Allow owners/admins to list their own tenant's folder for management UI.
CREATE POLICY "Owners/admins can list tenant assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role)
      OR has_tenant_role(auth.uid(), 'admin'::app_role)
      OR is_system_admin(auth.uid())
    )
  );
