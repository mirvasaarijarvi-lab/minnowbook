
-- ============================================================
-- 1. FIX ERROR: SECURITY DEFINER view → security_invoker
-- ============================================================
ALTER VIEW public.tenants_safe SET (security_invoker = true);

-- ============================================================
-- 2. FIX WARNING: booking_tokens readable by all staff
--    Restrict SELECT to owners/admins; keep ALL for service role
--    operations (token creation by staff still allowed via INSERT).
-- ============================================================
DROP POLICY IF EXISTS "Staff can manage booking tokens" ON public.booking_tokens;

CREATE POLICY "Owners/admins can view booking tokens"
  ON public.booking_tokens
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  );

CREATE POLICY "Staff can create booking tokens"
  ON public.booking_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners/admins can update booking tokens"
  ON public.booking_tokens
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  );

CREATE POLICY "Owners/admins can delete booking tokens"
  ON public.booking_tokens
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  );

-- ============================================================
-- 3. FIX WARNING: guest_reviews.guest_email exposed to staff
--    Restrict SELECT of guest PII to owners/admins.
--    Staff can still view reviews via a PII-free view.
-- ============================================================
DROP POLICY IF EXISTS "Staff can manage reviews" ON public.guest_reviews;

CREATE POLICY "Owners/admins can view guest reviews"
  ON public.guest_reviews
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  );

CREATE POLICY "Owners/admins can insert guest reviews"
  ON public.guest_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  );

CREATE POLICY "Owners/admins can update guest reviews"
  ON public.guest_reviews
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  );

CREATE POLICY "Owners/admins can delete guest reviews"
  ON public.guest_reviews
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  );

-- PII-free view for staff
CREATE OR REPLACE VIEW public.guest_reviews_safe
WITH (security_invoker = true) AS
SELECT
  id,
  tenant_id,
  site_id,
  reservation_id,
  guest_name,
  rating,
  comment,
  is_published,
  created_at
FROM public.guest_reviews;

GRANT SELECT ON public.guest_reviews_safe TO authenticated, anon;

-- ============================================================
-- 4. FIX WARNING: suppressed_emails has no admin SELECT
-- ============================================================
CREATE POLICY "System admins can read suppressed emails"
  ON public.suppressed_emails
  FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));
