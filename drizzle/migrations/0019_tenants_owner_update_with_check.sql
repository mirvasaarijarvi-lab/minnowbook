-- Harden the owner UPDATE policy on public.tenants:
-- add an explicit WITH CHECK (previously implicit) scoped to authenticated,
-- and keep billing/subscription columns unwritable by owners via a
-- column-comparison guard in the trigger (already enforced).
DROP POLICY IF EXISTS "Owners can update their tenant" ON public.tenants;

CREATE POLICY "Owners can update their tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  is_user_tenant_member(auth.uid(), id)
  AND has_tenant_role(auth.uid(), 'owner'::app_role, id)
)
WITH CHECK (
  is_user_tenant_member(auth.uid(), id)
  AND has_tenant_role(auth.uid(), 'owner'::app_role, id)
  -- Billing-sensitive values must match the persisted row; owners cannot
  -- introduce new billing state. Any change is rejected by the
  -- protect_tenant_billing_columns trigger, which compares OLD/NEW.
  AND EXISTS (
    SELECT 1
    FROM public.tenants existing
    WHERE existing.id = tenants.id
      AND existing.tier IS NOT DISTINCT FROM tenants.tier
      AND existing.subscription_status IS NOT DISTINCT FROM tenants.subscription_status
      AND existing.stripe_customer_id IS NOT DISTINCT FROM tenants.stripe_customer_id
      AND existing.stripe_subscription_id IS NOT DISTINCT FROM tenants.stripe_subscription_id
      AND existing.discount_percentage IS NOT DISTINCT FROM tenants.discount_percentage
      AND existing.discount_reason IS NOT DISTINCT FROM tenants.discount_reason
      AND existing.discount_granted_by IS NOT DISTINCT FROM tenants.discount_granted_by
      AND existing.sample_start_date IS NOT DISTINCT FROM tenants.sample_start_date
      AND existing.sample_end_date IS NOT DISTINCT FROM tenants.sample_end_date
  )
);