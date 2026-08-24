-- Restrict anonymous visibility of internal free-text/staff columns on
-- scheduling tables. Anonymous booking visitors keep access to the
-- timing columns they need to compute availability, but internal notes
-- (reason, rejection_reason) and staff identifiers are no longer readable.

REVOKE SELECT ON public.blocked_slots FROM anon;
GRANT SELECT (
  id, tenant_id, site_id, resource_id, resource_type,
  date, start_time, end_time, approval_status, created_at
) ON public.blocked_slots TO anon;

REVOKE SELECT ON public.recurring_blocked_slots FROM anon;
GRANT SELECT (
  id, tenant_id, site_id, resource_id, resource_type,
  day_of_week, start_time, end_time, is_active, approval_status, created_at
) ON public.recurring_blocked_slots TO anon;

REVOKE SELECT ON public.tenant_opening_hours FROM anon;
GRANT SELECT (
  id, tenant_id, site_id, resource_type, day_of_week,
  open_time, close_time, is_closed, approval_status, created_at
) ON public.tenant_opening_hours TO anon;

REVOKE SELECT ON public.resource_opening_hours FROM anon;
GRANT SELECT (
  id, tenant_id, resource_id, day_of_week,
  open_time, close_time, is_closed, created_at
) ON public.resource_opening_hours TO anon;