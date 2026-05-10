-- Make the tenant-assets policies tolerate non-UUID first segments
-- (e.g., the legacy 'email-assets/' folder) so list/select queries don't
-- error out on the cast. Non-UUID prefixes simply fail the membership
-- check (no access), instead of raising.

DROP POLICY IF EXISTS "tenant-assets members select" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets members manage avatars and resources" ON storage.objects;

CREATE POLICY "tenant-assets members select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "tenant-assets members manage avatars and resources"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[2] IN ('avatars', 'resources')
)
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[2] IN ('avatars', 'resources')
);

-- Same hardening on tenant-branding's member-write policy.
DROP POLICY IF EXISTS "tenant-branding members manage logo and hero" ON storage.objects;
CREATE POLICY "tenant-branding members manage logo and hero"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'tenant-branding'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (
    name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]+$')
    OR (storage.foldername(name))[2] IN ('logo', 'hero')
  )
)
WITH CHECK (
  bucket_id = 'tenant-branding'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (
    name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]+$')
    OR (storage.foldername(name))[2] IN ('logo', 'hero')
  )
);