-- Security alerting: failed authentication attempts and unusual reservation access.
-- Alerts are surfaced in-app to platform (system) admins.

-- ---------------------------------------------------------------- auth failures
CREATE TABLE public.auth_failure_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_masked text NOT NULL,
  email_hash text NOT NULL,
  reason text NOT NULL,
  tenant_slug text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auth_failure_log TO authenticated;
GRANT ALL ON public.auth_failure_log TO service_role;

ALTER TABLE public.auth_failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins read auth failures"
  ON public.auth_failure_log FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE INDEX auth_failure_log_created_at_idx ON public.auth_failure_log (created_at DESC);
CREATE INDEX auth_failure_log_email_hash_idx ON public.auth_failure_log (email_hash, created_at DESC);

-- ------------------------------------------------- reservation access telemetry
CREATE TABLE public.reservation_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  site_id uuid,
  action text NOT NULL CHECK (action IN ('view', 'search', 'export', 'print')),
  record_count integer NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reservation_access_log TO authenticated;
GRANT ALL ON public.reservation_access_log TO service_role;

ALTER TABLE public.reservation_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins and system admins read reservation access"
  ON public.reservation_access_log FOR SELECT TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    OR public.has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
  );

CREATE INDEX reservation_access_log_user_idx
  ON public.reservation_access_log (user_id, created_at DESC);
CREATE INDEX reservation_access_log_tenant_idx
  ON public.reservation_access_log (tenant_id, created_at DESC);

-- --------------------------------------------------------------- alert records
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('failed_auth_burst', 'unusual_reservation_access')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  dedupe_key text NOT NULL UNIQUE,
  subject text,
  user_id uuid,
  score integer NOT NULL DEFAULT 0,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  window_start timestamptz,
  window_end timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid
);

GRANT SELECT, UPDATE ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins read security events"
  ON public.security_events FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins acknowledge security events"
  ON public.security_events FOR UPDATE TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE INDEX security_events_open_idx
  ON public.security_events (detected_at DESC)
  WHERE acknowledged_at IS NULL;

-- ------------------------------------------------------------------- recorders
-- Failed sign-in attempts are recorded before a session exists, so anon may
-- call this. The raw address is never stored: only a masked form for display
-- and a salted hash for correlating repeated attempts.
CREATE OR REPLACE FUNCTION public.record_auth_failure(
  p_email text,
  p_reason text,
  p_tenant_slug text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_local text;
  v_domain text;
  v_masked text;
  v_recent integer;
BEGIN
  -- Cheap flood guard so the log cannot be used to fill the database.
  SELECT count(*) INTO v_recent
  FROM public.auth_failure_log
  WHERE created_at > now() - interval '1 minute';
  IF v_recent > 500 THEN
    RETURN;
  END IF;

  IF position('@' IN v_email) > 1 THEN
    v_local := split_part(v_email, '@', 1);
    v_domain := split_part(v_email, '@', 2);
    v_masked := left(v_local, 1) || repeat('*', greatest(length(v_local) - 1, 1)) || '@' || v_domain;
  ELSE
    v_masked := 'unknown';
  END IF;

  INSERT INTO public.auth_failure_log (
    email_masked, email_hash, reason, tenant_slug, user_agent
  ) VALUES (
    v_masked,
    encode(digest(v_email || 'mimmobook-auth-failure', 'sha256'), 'hex'),
    left(coalesce(nullif(trim(p_reason), ''), 'unknown'), 200),
    left(nullif(trim(coalesce(p_tenant_slug, '')), ''), 100),
    left(nullif(trim(coalesce(p_user_agent, '')), ''), 300)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_auth_failure(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_auth_failure(text, text, text, text) TO anon, authenticated;

-- Reservation reads/exports are recorded for the calling staff member only.
CREATE OR REPLACE FUNCTION public.log_reservation_access(
  p_tenant_id uuid,
  p_action text,
  p_record_count integer DEFAULT 0,
  p_site_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF p_action NOT IN ('view', 'search', 'export', 'print') THEN
    RETURN;
  END IF;

  IF NOT public.is_system_admin(v_user)
     AND NOT EXISTS (
       SELECT 1 FROM public.tenant_users tu
       WHERE tu.user_id = v_user AND tu.tenant_id = p_tenant_id
     ) THEN
    RETURN;
  END IF;

  INSERT INTO public.reservation_access_log (
    tenant_id, user_id, site_id, action, record_count
  ) VALUES (
    p_tenant_id, v_user, p_site_id, p_action, greatest(coalesce(p_record_count, 0), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_reservation_access(uuid, text, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_reservation_access(uuid, text, integer, uuid) TO authenticated;

-- ------------------------------------------------------------------- detection
-- Scores the last 24h of telemetry and records one alert per finding.
-- p_sensitivity: 1 = only clear incidents, 5 = flag anything odd (default 3).
CREATE OR REPLACE FUNCTION public.detect_security_alerts(p_sensitivity integer DEFAULT 3)
RETURNS SETOF public.security_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_sens integer := least(greatest(coalesce(p_sensitivity, 3), 1), 5);
  v_fail_threshold integer;
  v_spike_factor numeric;
  v_min_records integer;
  v_score_threshold integer;
  r record;
BEGIN
  IF v_caller IS NULL OR NOT public.is_system_admin(v_caller) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  v_fail_threshold := greatest(13 - v_sens * 2, 3);      -- 3 -> 7 attempts / 15 min
  v_spike_factor := 5 - (v_sens - 1) * 0.75;             -- 3 -> 3.5x baseline
  v_min_records := greatest(130 - v_sens * 25, 20);      -- 3 -> 55 records / day
  v_score_threshold := greatest(6 - v_sens, 1);          -- 3 -> score 3

  -- Retention: keep telemetry and alerts for 90 days.
  DELETE FROM public.auth_failure_log WHERE created_at < now() - interval '90 days';
  DELETE FROM public.reservation_access_log WHERE created_at < now() - interval '90 days';
  DELETE FROM public.security_events WHERE detected_at < now() - interval '90 days';

  -- 1) Bursts of failed sign-ins against the same address.
  FOR r IN
    SELECT
      email_hash,
      max(email_masked) AS email_masked,
      count(*) AS attempts,
      min(created_at) AS first_at,
      max(created_at) AS last_at,
      date_trunc('hour', max(created_at)) AS bucket,
      array_agg(DISTINCT reason) AS reasons
    FROM public.auth_failure_log
    WHERE created_at > now() - interval '24 hours'
    GROUP BY email_hash, date_trunc('hour', created_at)
    HAVING count(*) >= v_fail_threshold
  LOOP
    INSERT INTO public.security_events (
      event_type, severity, dedupe_key, subject, score, signals,
      window_start, window_end
    ) VALUES (
      'failed_auth_burst',
      CASE
        WHEN r.attempts >= v_fail_threshold * 3 THEN 'high'
        WHEN r.attempts >= v_fail_threshold * 2 THEN 'medium'
        ELSE 'low'
      END,
      'auth:' || r.email_hash || ':' || to_char(r.bucket, 'YYYYMMDDHH24'),
      r.email_masked,
      r.attempts,
      jsonb_build_object(
        'attempts', r.attempts,
        'threshold', v_fail_threshold,
        'reasons', to_jsonb(r.reasons),
        'sensitivity', v_sens
      ),
      r.first_at,
      r.last_at
    )
    ON CONFLICT (dedupe_key) DO UPDATE
      SET score = EXCLUDED.score,
          severity = EXCLUDED.severity,
          signals = EXCLUDED.signals,
          window_end = EXCLUDED.window_end,
          detected_at = now();
  END LOOP;

  -- 2) Unusual access to reservation data: volume spike, off-hours or new
  --    device/location, and reach into sites the account rarely touches.
  FOR r IN
    WITH baseline AS (
      SELECT
        user_id,
        tenant_id,
        sum(record_count)::numeric / 14 AS avg_daily_records,
        array_agg(DISTINCT site_id) FILTER (WHERE site_id IS NOT NULL) AS sites,
        bool_or(
          extract(hour FROM created_at AT TIME ZONE 'Europe/Helsinki') >= 22
          OR extract(hour FROM created_at AT TIME ZONE 'Europe/Helsinki') < 6
        ) AS off_hours_is_normal,
        count(*) AS baseline_events
      FROM public.reservation_access_log
      WHERE created_at BETWEEN now() - interval '15 days' AND now() - interval '24 hours'
      GROUP BY user_id, tenant_id
    ),
    recent AS (
      SELECT
        user_id,
        tenant_id,
        sum(record_count) AS records,
        count(*) AS events,
        min(created_at) AS first_at,
        max(created_at) AS last_at,
        count(*) FILTER (
          WHERE extract(hour FROM created_at AT TIME ZONE 'Europe/Helsinki') >= 22
             OR extract(hour FROM created_at AT TIME ZONE 'Europe/Helsinki') < 6
        ) AS off_hours_events,
        array_agg(DISTINCT site_id) FILTER (WHERE site_id IS NOT NULL) AS sites,
        count(*) FILTER (WHERE action IN ('export', 'print')) AS export_events
      FROM public.reservation_access_log
      WHERE created_at > now() - interval '24 hours'
      GROUP BY user_id, tenant_id
    )
    SELECT
      recent.*,
      coalesce(baseline.avg_daily_records, 0) AS avg_daily_records,
      coalesce(baseline.baseline_events, 0) AS baseline_events,
      coalesce(baseline.off_hours_is_normal, false) AS off_hours_is_normal,
      coalesce(baseline.sites, ARRAY[]::uuid[]) AS known_sites
    FROM recent
    LEFT JOIN baseline
      ON baseline.user_id = recent.user_id
     AND baseline.tenant_id = recent.tenant_id
  LOOP
    DECLARE
      v_volume boolean;
      v_off_hours boolean;
      v_new_sites uuid[];
      v_score integer := 0;
      v_severity text;
    BEGIN
      v_volume := r.records >= v_min_records
        AND (r.avg_daily_records = 0 OR r.records > r.avg_daily_records * v_spike_factor);

      v_off_hours := r.off_hours_events > 0 AND NOT r.off_hours_is_normal;

      SELECT coalesce(array_agg(s), ARRAY[]::uuid[]) INTO v_new_sites
      FROM unnest(coalesce(r.sites, ARRAY[]::uuid[])) AS s
      WHERE r.baseline_events > 0 AND NOT (s = ANY (r.known_sites));

      IF v_volume THEN v_score := v_score + 2; END IF;
      IF v_off_hours THEN v_score := v_score + 1; END IF;
      IF array_length(v_new_sites, 1) > 0 THEN v_score := v_score + 2; END IF;
      IF r.export_events > 0 AND v_volume THEN v_score := v_score + 1; END IF;

      IF v_score < v_score_threshold THEN
        CONTINUE;
      END IF;

      v_severity := CASE
        WHEN v_score >= 5 THEN 'high'
        WHEN v_score >= 3 THEN 'medium'
        ELSE 'low'
      END;

      INSERT INTO public.security_events (
        tenant_id, event_type, severity, dedupe_key, subject, user_id, score,
        signals, window_start, window_end
      ) VALUES (
        r.tenant_id,
        'unusual_reservation_access',
        v_severity,
        'res:' || r.user_id || ':' || r.tenant_id || ':' || to_char(now(), 'YYYYMMDD'),
        (
          SELECT coalesce(nullif(tu.display_name, ''), r.user_id::text)
          FROM public.tenant_users tu
          WHERE tu.user_id = r.user_id AND tu.tenant_id = r.tenant_id
          LIMIT 1
        ),
        r.user_id,
        v_score,
        jsonb_build_object(
          'records', r.records,
          'events', r.events,
          'exports', r.export_events,
          'baselineDailyRecords', round(r.avg_daily_records, 1),
          'volumeSpike', v_volume,
          'offHours', v_off_hours,
          'offHoursEvents', r.off_hours_events,
          'newSites', array_length(v_new_sites, 1),
          'sensitivity', v_sens
        ),
        r.first_at,
        r.last_at
      )
      ON CONFLICT (dedupe_key) DO UPDATE
        SET score = EXCLUDED.score,
            severity = EXCLUDED.severity,
            signals = EXCLUDED.signals,
            window_end = EXCLUDED.window_end,
            detected_at = now();
    END;
  END LOOP;

  RETURN QUERY
    SELECT *
    FROM public.security_events
    WHERE acknowledged_at IS NULL
    ORDER BY
      CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      detected_at DESC
    LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_security_alerts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_security_alerts(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.acknowledge_security_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL OR NOT public.is_system_admin(v_caller) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.security_events
  SET acknowledged_at = now(), acknowledged_by = v_caller
  WHERE id = p_event_id AND acknowledged_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_security_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acknowledge_security_event(uuid) TO authenticated;