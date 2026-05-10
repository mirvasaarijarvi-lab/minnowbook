-- 1) Create the new public branding bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-branding', 'tenant-branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2) Flip tenant-assets to private.
UPDATE storage.buckets SET public = false WHERE id = 'tenant-assets';

-- 3) Policies on tenant-branding (public read; scoped writes).
DROP POLICY IF EXISTS "tenant-branding public read" ON storage.objects;
CREATE POLICY "tenant-branding public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'tenant-branding');

DROP POLICY IF EXISTS "tenant-branding system admin email-assets" ON storage.objects;
CREATE POLICY "tenant-branding system admin email-assets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'tenant-branding'
  AND (storage.foldername(name))[1] = 'email-assets'
  AND public.is_system_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'tenant-branding'
  AND (storage.foldername(name))[1] = 'email-assets'
  AND public.is_system_admin(auth.uid())
);

DROP POLICY IF EXISTS "tenant-branding members manage logo and hero" ON storage.objects;
CREATE POLICY "tenant-branding members manage logo and hero"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'tenant-branding'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (
    name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]+$')
    OR (storage.foldername(name))[2] IN ('logo', 'hero')
  )
)
WITH CHECK (
  bucket_id = 'tenant-branding'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (
    name ~ ('^' || (storage.foldername(name))[1] || '/(logo|hero)\.[A-Za-z0-9]+$')
    OR (storage.foldername(name))[2] IN ('logo', 'hero')
  )
);

-- 4) Tighten tenant-assets: now that it is private, replace the legacy
--    public-read + branding-whitelist policies with simple tenant-scoped
--    rules. Branding writes have moved to tenant-branding.
DROP POLICY IF EXISTS "Public can view tenant assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read tenant-assets" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets system admin email-assets" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets members manage logo and hero" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets members manage avatars and resources" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets members select" ON storage.objects;

CREATE POLICY "tenant-assets members select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "tenant-assets members manage avatars and resources"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[2] IN ('avatars', 'resources')
)
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[2] IN ('avatars', 'resources')
);