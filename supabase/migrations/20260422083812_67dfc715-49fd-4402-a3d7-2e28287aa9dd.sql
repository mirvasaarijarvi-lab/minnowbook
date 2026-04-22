-- Helper function for system admins to detect tenant_users integrity issues.
-- Returns one row per user who is a member of more than one tenant.
-- Used by the Superadmin "Tenant Membership Check" page to verify the
-- UNIQUE (user_id) constraint on tenant_users is holding and that
-- get_user_tenant_id() can resolve a single tenant for every user.
CREATE OR REPLACE FUNCTION public.find_users_with_multiple_tenants()
RETURNS TABLE(
  user_id uuid,
  tenant_count bigint,
  tenant_ids uuid[],
  tenant_names text[],
  resolved_tenant_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    tu.user_id,
    COUNT(*)::bigint AS tenant_count,
    ARRAY_AGG(tu.tenant_id ORDER BY tu.tenant_id) AS tenant_ids,
    ARRAY_AGG(t.name ORDER BY tu.tenant_id) AS tenant_names,
    public.get_user_tenant_id(tu.user_id) AS resolved_tenant_id
  FROM public.tenant_users tu
  LEFT JOIN public.tenants t ON t.id = tu.tenant_id
  GROUP BY tu.user_id
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
END;
$$;

-- Aggregate health stats for the membership check page.
CREATE OR REPLACE FUNCTION public.get_tenant_membership_health()
RETURNS TABLE(
  total_memberships bigint,
  unique_users bigint,
  users_with_multiple_tenants bigint,
  users_with_no_resolvable_tenant bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.tenant_users)::bigint,
    (SELECT COUNT(DISTINCT user_id) FROM public.tenant_users)::bigint,
    (
      SELECT COUNT(*) FROM (
        SELECT user_id FROM public.tenant_users
        GROUP BY user_id HAVING COUNT(*) > 1
      ) sub
    )::bigint,
    (
      SELECT COUNT(*) FROM (
        SELECT user_id FROM public.tenant_users
        GROUP BY user_id HAVING COUNT(*) > 1
      ) sub
    )::bigint;
END;
$$;