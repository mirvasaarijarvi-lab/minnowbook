-- 1. Helper: max staff users per tier
CREATE OR REPLACE FUNCTION public.get_tier_max_staff_users(p_tier text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE p_tier
    WHEN 'basic' THEN 5
    WHEN 'professional' THEN 25
    WHEN 'business' THEN 999999
    ELSE 5
  END;
$$;

-- 2. Trigger: block new tenant_users INSERT over the tier limit.
--    UPDATE/DELETE are unaffected so existing memberships keep working
--    after a downgrade — only new additions are blocked.
CREATE OR REPLACE FUNCTION public.enforce_staff_user_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier text;
  v_max integer;
  v_current_count integer;
BEGIN
  IF public.is_system_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT tier INTO v_tier FROM public.tenants WHERE id = NEW.tenant_id;
  v_max := public.get_tier_max_staff_users(v_tier);

  SELECT count(*) INTO v_current_count
  FROM public.tenant_users
  WHERE tenant_id = NEW.tenant_id;

  IF v_current_count >= v_max THEN
    RAISE EXCEPTION
      'Tier "%" allows at most % staff user(s). Upgrade your plan to add more.',
      v_tier, v_max;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_staff_user_limit_trigger ON public.tenant_users;
CREATE TRIGGER enforce_staff_user_limit_trigger
BEFORE INSERT ON public.tenant_users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_staff_user_limit();

-- 3. Drop and recreate tenants_safe view without the max_staff_users column,
--    then drop the underlying column on tenants.
DROP VIEW IF EXISTS public.tenants_safe;

CREATE VIEW public.tenants_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  slug,
  owner_user_id,
  subscription_status,
  tier,
  allowed_reservation_types,
  is_active,
  created_at,
  updated_at,
  sample_start_date,
  sample_end_date,
  discount_percentage,
  discount_reason,
  discount_granted_by,
  CASE
    WHEN has_tenant_role(auth.uid(), 'owner'::app_role, id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
      OR is_system_admin(auth.uid()) THEN stripe_customer_id
    ELSE NULL::text
  END AS stripe_customer_id,
  CASE
    WHEN has_tenant_role(auth.uid(), 'owner'::app_role, id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, id)
      OR is_system_admin(auth.uid()) THEN stripe_subscription_id
    ELSE NULL::text
  END AS stripe_subscription_id
FROM public.tenants
WHERE id = get_user_tenant_id(auth.uid()) OR is_system_admin(auth.uid());

ALTER TABLE public.tenants DROP COLUMN IF EXISTS max_staff_users;