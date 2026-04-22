-- 1. Tighten email-assets/ read access in tenant-assets bucket.
-- The shared /email-assets/ folder previously allowed reads from ANY
-- authenticated user. Restrict to system admins; anon/public reads via the
-- bucket's public URL (used by emails and public booking pages) are
-- unaffected because they don't go through the authenticated SELECT policy.
DROP POLICY IF EXISTS "tenant-assets: tenant-scoped read" ON storage.objects;

CREATE POLICY "tenant-assets: tenant-scoped read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-assets' AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.access_code_redemptions r
        WHERE r.redeemed_by = auth.uid()
          AND r.is_active = true
          AND r.revoked_at IS NULL
          AND r.tenant_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- 2. Drop older overlapping INSERT policies on tenant-assets.
-- Postgres OR's permissive policies, so leaving these in place would let
-- any tenant member upload (broader than intended). Keep only the strict
-- "tenant-assets: tenant-scoped insert" policy already in place.
DROP POLICY IF EXISTS "Owners/admins can upload tenant assets" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: members can upload to own tenant" ON storage.objects;

-- 3. Allow owners/admins to DELETE booking_validation_log rows for their tenant.
-- Lets tenant owners purge guest PII captured in failed booking attempts.
DROP POLICY IF EXISTS "Owners/admins can delete validation log" ON public.booking_validation_log;

CREATE POLICY "Owners/admins can delete validation log"
  ON public.booking_validation_log FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
      OR public.has_tenant_role(auth.uid(), 'admin'::public.app_role, tenant_id)
    )
  );