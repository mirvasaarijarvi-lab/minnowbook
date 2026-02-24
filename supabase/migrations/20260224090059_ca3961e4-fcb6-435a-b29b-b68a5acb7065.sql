
-- Create a public storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', true);

-- Allow authenticated users to upload to their tenant's folder
CREATE POLICY "Tenant owners can upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
);

-- Allow authenticated users to update their tenant's assets
CREATE POLICY "Tenant owners can update assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
);

-- Allow authenticated users to delete their tenant's assets
CREATE POLICY "Tenant owners can delete assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
);

-- Allow public read access (logos are public)
CREATE POLICY "Public can view tenant assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tenant-assets');
