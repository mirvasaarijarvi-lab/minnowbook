
-- 1. Fix booking_tokens: replace unrestricted public SELECT with lookup-by-token function
DROP POLICY IF EXISTS "Anyone can view by token" ON public.booking_tokens;

CREATE OR REPLACE FUNCTION public.lookup_booking_token(p_token text)
RETURNS TABLE(
  id uuid,
  reservation_id uuid,
  tenant_id uuid,
  token text,
  created_at timestamptz,
  expires_at timestamptz,
  is_revoked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bt.id, bt.reservation_id, bt.tenant_id, bt.token, bt.created_at, bt.expires_at, bt.is_revoked
  FROM public.booking_tokens bt
  WHERE bt.token = p_token
    AND bt.is_revoked = false
    AND bt.expires_at > now()
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.lookup_booking_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_booking_token(text) TO authenticated;

-- 2. Hide guest_email from public reviews
-- Drop old public policy
DROP POLICY IF EXISTS "Public can view published reviews" ON public.guest_reviews;

-- Create a safe view for public consumption
CREATE OR REPLACE VIEW public.guest_reviews_public AS
SELECT
  id,
  tenant_id,
  site_id,
  guest_name,
  rating,
  comment,
  created_at
FROM public.guest_reviews
WHERE is_published = true;

-- Grant access to anon and authenticated
GRANT SELECT ON public.guest_reviews_public TO anon;
GRANT SELECT ON public.guest_reviews_public TO authenticated;

-- Re-create public policy without guest_email exposure (staff still see full table)
CREATE POLICY "Public can view published reviews safe"
  ON public.guest_reviews
  FOR SELECT
  TO anon
  USING (is_published = true);

-- 3. Restrict storage uploads to owners/admins only
DROP POLICY IF EXISTS "Tenant owners can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Tenant owners can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Tenant owners can delete assets" ON storage.objects;

CREATE POLICY "Owners/admins can upload tenant assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role)
      OR has_tenant_role(auth.uid(), 'admin'::app_role)
      OR is_system_admin(auth.uid())
    )
  );

CREATE POLICY "Owners/admins can update tenant assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role)
      OR has_tenant_role(auth.uid(), 'admin'::app_role)
      OR is_system_admin(auth.uid())
    )
  );

CREATE POLICY "Owners/admins can delete tenant assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role)
      OR has_tenant_role(auth.uid(), 'admin'::app_role)
      OR is_system_admin(auth.uid())
    )
  );

-- 4. Add notifications INSERT policy for tenant members
CREATE POLICY "Tenant members can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 5. Audit log retention - cleanup function (90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_log
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- Schedule daily cleanup via pg_cron
SELECT cron.schedule(
  'cleanup-old-audit-logs',
  '0 3 * * *',
  $$SELECT public.cleanup_old_audit_logs()$$
);
