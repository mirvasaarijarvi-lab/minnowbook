-- 1) access_codes: scope tenant visibility to ACTIVE redemptions of the caller's
--    own tenants, and never expose codes to non-members. Explicit, self-contained
--    USING clause (no reliance on an implicit join being "correct enough").
DROP POLICY IF EXISTS "Tenants can view their redeemed access codes" ON public.access_codes;

CREATE POLICY "Tenants can view their redeemed access codes"
ON public.access_codes
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.access_code_redemptions acr
    WHERE acr.access_code_id = access_codes.id
      AND acr.is_active = true
      AND acr.revoked_at IS NULL
      AND public.is_user_tenant_member(auth.uid(), acr.tenant_id)
  )
);

-- 2) resource_images: align the public read policy with the other public booking
--    policies by requiring the owning tenant to be active, and keep the image row
--    tied to the same tenant as its resource.
DROP POLICY IF EXISTS "Public can view resource images" ON public.resource_images;

CREATE POLICY "Public can view resource images"
ON public.resource_images
FOR SELECT
TO anon, authenticated
USING (
  public.is_tenant_active(tenant_id)
  AND EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE r.id = resource_images.resource_id
      AND r.tenant_id = resource_images.tenant_id
      AND r.is_active = true
      AND r.approval_status = 'approved'
  )
);

-- 3) reservations public INSERT: make the policy independently sufficient.
--    a) Guard function: the policy only passes while the BEFORE INSERT
--       validation/sanitisation triggers are present and enabled, so the policy can
--       never become the sole enforcement layer silently.
CREATE OR REPLACE FUNCTION public.public_reservation_guards_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) = 2
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'reservations'
    AND NOT t.tgisinternal
    AND t.tgenabled <> 'D'
    AND t.tgname IN (
      'trg_validate_public_reservation_insert',
      'trg_zz_sanitize_reservation_pricing'
    );
$$;

REVOKE ALL ON FUNCTION public.public_reservation_guards_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_reservation_guards_enabled() TO anon, authenticated, service_role;

--    b) Recreate the policy with the guard plus the remaining privileged/pricing
--       columns that were not previously constrained.
DROP POLICY IF EXISTS "Public can create reservations for active tenants" ON public.reservations;

CREATE POLICY "Public can create reservations for active tenants"
ON public.reservations
FOR INSERT
TO anon
WITH CHECK (
  public.public_reservation_guards_enabled()
  AND public.is_tenant_active(tenant_id)
  AND NOT (status IS DISTINCT FROM 'pending'::text)
  AND NOT (is_invoiced IS DISTINCT FROM false)
  AND NOT (is_checked_in IS DISTINCT FROM false)
  AND NOT (is_used IS DISTINCT FROM false)
  AND NOT (staff_needed IS DISTINCT FROM false)
  AND price_eur IS NULL
  AND original_price_eur IS NULL
  AND pricing_details IS NULL
  AND pricing_type IS NULL
  AND stall_fee IS NULL
  AND discount_code_id IS NULL
  AND discount_type IS NULL
  AND discount_value IS NULL
  AND discount_reason IS NULL
  AND internal_notes IS NULL
  AND staff_notes IS NULL
  AND created_by IS NULL
  AND linked_group_id IS NULL
  AND acknowledgment_email_sent_at IS NULL
  AND confirmation_email_sent_at IS NULL
  AND cancellation_email_sent_at IS NULL
  AND reminder_email_sent_at IS NULL
);
