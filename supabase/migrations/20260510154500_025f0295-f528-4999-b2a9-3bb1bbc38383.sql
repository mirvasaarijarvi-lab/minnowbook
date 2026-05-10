-- Broaden tenant-assets write policy to allow any tenant member to manage
-- any object under their tenant prefix, not just 'avatars'/'resources'
-- subfolders. The first-segment tenant-id check still gates cross-tenant
-- access; subfolder structure is an application concern.

DROP POLICY IF EXISTS "tenant-assets members manage avatars and resources" ON storage.objects;

CREATE POLICY "tenant-assets members manage own tenant"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);