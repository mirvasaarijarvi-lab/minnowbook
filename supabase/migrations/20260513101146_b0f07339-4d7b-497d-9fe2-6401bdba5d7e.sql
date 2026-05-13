-- Remove anon listing on the public tenant-branding bucket.
-- Public buckets serve individual object URLs via the storage CDN without
-- consulting RLS, so dropping this SELECT policy stops anon listing while
-- keeping known logo/hero URLs accessible.
DROP POLICY IF EXISTS "tenant-branding public read" ON storage.objects;