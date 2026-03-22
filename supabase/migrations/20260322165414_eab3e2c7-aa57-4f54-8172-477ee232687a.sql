-- Create a safe view that hides Stripe columns from non-owner/admin users
CREATE OR REPLACE VIEW public.tenants_safe
WITH (security_invoker = true)
AS
SELECT
  id, name, slug, owner_user_id, subscription_status, tier,
  allowed_reservation_types, max_staff_users, is_active,
  created_at, updated_at, sample_start_date, sample_end_date,
  discount_percentage, discount_reason, discount_granted_by,
  CASE
    WHEN has_tenant_role(auth.uid(), 'owner'::app_role, id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
      OR is_system_admin(auth.uid())
    THEN stripe_customer_id
    ELSE NULL
  END AS stripe_customer_id,
  CASE
    WHEN has_tenant_role(auth.uid(), 'owner'::app_role, id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
      OR is_system_admin(auth.uid())
    THEN stripe_subscription_id
    ELSE NULL
  END AS stripe_subscription_id
FROM public.tenants;