-- ============================================================
-- Storage rejection telemetry + spike alerting
-- ============================================================

-- ---- Events table -----------------------------------------------------------
CREATE TABLE public.storage_rejection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL,
  callsite text NULL,
  reason text NOT NULL,
  input_length integer NOT NULL DEFAULT 0,
  segment_count integer NULL,
  leading_char_class text NOT NULL DEFAULT 'none',
  has_scheme_shape boolean NOT NULL DEFAULT false,
  has_backslash boolean NOT NULL DEFAULT false,
  has_control_char boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Defence in depth: keep callsite tags short and printable so an
-- abusive caller cannot bloat the table with multi-MB strings.
ALTER TABLE public.storage_rejection_events
  ADD CONSTRAINT storage_rejection_events_callsite_len
    CHECK (callsite IS NULL OR char_length(callsite) <= 80),
  ADD CONSTRAINT storage_rejection_events_reason_len
    CHECK (char_length(reason) <= 64),
  ADD CONSTRAINT storage_rejection_events_leading_class_len
    CHECK (char_length(leading_char_class) <= 16);

-- Spike-query indexes. Most queries filter by (tenant_id, created_at)
-- or (callsite, created_at) over a short trailing window.
CREATE INDEX storage_rejection_events_tenant_created_idx
  ON public.storage_rejection_events (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX storage_rejection_events_callsite_created_idx
  ON public.storage_rejection_events (callsite, created_at DESC)
  WHERE callsite IS NOT NULL;
CREATE INDEX storage_rejection_events_created_idx
  ON public.storage_rejection_events (created_at DESC);

ALTER TABLE public.storage_rejection_events ENABLE ROW LEVEL SECURITY;

-- Service role inserts. No INSERT policy exists for clients, so the
-- only writer is the report-storage-rejection edge function.
CREATE POLICY "System admins can read all rejection events"
  ON public.storage_rejection_events
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Tenant owners can read their tenant's rejection events"
  ON public.storage_rejection_events
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND (
      public.has_permission(auth.uid(), 'admin.view', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
      OR public.has_tenant_role(auth.uid(), 'superadmin'::public.app_role, tenant_id)
    )
  );

-- ---- Alerts table -----------------------------------------------------------
CREATE TABLE public.storage_rejection_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  tenant_id uuid NULL,
  callsite text NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  event_count integer NOT NULL,
  threshold integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);

ALTER TABLE public.storage_rejection_alerts
  ADD CONSTRAINT storage_rejection_alerts_scope_check
    CHECK (scope IN ('tenant', 'callsite', 'tenant_callsite')),
  ADD CONSTRAINT storage_rejection_alerts_callsite_len
    CHECK (callsite IS NULL OR char_length(callsite) <= 80),
  ADD CONSTRAINT storage_rejection_alerts_count_positive
    CHECK (event_count > 0 AND threshold > 0),
  ADD CONSTRAINT storage_rejection_alerts_window_valid
    CHECK (window_end > window_start);

-- Dedup support: queries look for an unresolved alert with the same
-- scope key in the last N minutes before raising a new one.
CREATE INDEX storage_rejection_alerts_dedup_idx
  ON public.storage_rejection_alerts (scope, tenant_id, callsite, created_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX storage_rejection_alerts_tenant_idx
  ON public.storage_rejection_alerts (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

ALTER TABLE public.storage_rejection_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can read all rejection alerts"
  ON public.storage_rejection_alerts
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Tenant owners can read their tenant's rejection alerts"
  ON public.storage_rejection_alerts
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND (
      public.has_permission(auth.uid(), 'admin.view', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'owner'::public.app_role, tenant_id)
      OR public.has_tenant_role(auth.uid(), 'superadmin'::public.app_role, tenant_id)
    )
  );

-- System admins can mark alerts resolved.
CREATE POLICY "System admins can resolve rejection alerts"
  ON public.storage_rejection_alerts
  FOR UPDATE
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- ---- Cleanup function -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_storage_rejection_telemetry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.storage_rejection_events
   WHERE created_at < now() - interval '7 days';

  DELETE FROM public.storage_rejection_alerts
   WHERE resolved_at IS NOT NULL
     AND resolved_at < now() - interval '90 days';
END;
$$;