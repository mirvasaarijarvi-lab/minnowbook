
CREATE TABLE IF NOT EXISTS public.redemption_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id text NOT NULL,
  outcome text NOT NULL,
  decision text,
  reason text,
  status integer NOT NULL,
  duration_ms integer,
  user_id_hash text,
  tenant_id_hash text,
  access_code_id_hash text,
  had_idempotency_key boolean NOT NULL DEFAULT false,
  replayed boolean NOT NULL DEFAULT false,
  used_count integer,
  max_uses integer,
  error_message text
);

CREATE INDEX IF NOT EXISTS redemption_events_created_at_idx
  ON public.redemption_events (created_at DESC);
CREATE INDEX IF NOT EXISTS redemption_events_outcome_idx
  ON public.redemption_events (outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS redemption_events_reason_idx
  ON public.redemption_events (reason, created_at DESC);

GRANT ALL ON public.redemption_events TO service_role;

ALTER TABLE public.redemption_events ENABLE ROW LEVEL SECURITY;

-- Deny-by-default. The table is written by the edge function via the
-- service role and read by platform admins exclusively via the
-- get_redemption_metrics_24h RPC. No direct client access.
CREATE POLICY "redemption_events service role only"
  ON public.redemption_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.cleanup_old_redemption_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.redemption_events
   WHERE created_at < now() - interval '30 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_redemption_metrics_24h(p_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
  v_total bigint;
  v_success bigint;
  v_failure bigint;
  v_rate_limit bigint;
  v_replays bigint;
  v_unique_users bigint;
  v_p50 numeric;
  v_p95 numeric;
  v_outcomes jsonb;
  v_reasons jsonb;
  v_hourly jsonb;
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 168 THEN
    p_hours := 24;
  END IF;

  v_since := now() - make_interval(hours => p_hours);

  -- Headline counters.
  SELECT
    count(*),
    count(*) FILTER (WHERE outcome = 'success'),
    count(*) FILTER (WHERE status >= 400 AND outcome <> 'idempotent_replay'),
    count(*) FILTER (
      WHERE outcome IN ('request_too_large', 'invalid_idempotency_key', 'invalid_code_format')
         OR reason IN ('request_too_large', 'invalid_idempotency_key')
    ),
    count(*) FILTER (WHERE replayed = true),
    count(DISTINCT user_id_hash) FILTER (WHERE user_id_hash IS NOT NULL),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms)
      FILTER (WHERE duration_ms IS NOT NULL),
    percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)
      FILTER (WHERE duration_ms IS NOT NULL)
  INTO v_total, v_success, v_failure, v_rate_limit,
       v_replays, v_unique_users, v_p50, v_p95
  FROM public.redemption_events
  WHERE created_at >= v_since;

  -- Outcome breakdown.
  SELECT COALESCE(jsonb_object_agg(outcome, n), '{}'::jsonb)
  INTO v_outcomes
  FROM (
    SELECT outcome, count(*) AS n
    FROM public.redemption_events
    WHERE created_at >= v_since
    GROUP BY outcome
  ) o;

  -- Reason breakdown (rejection mix).
  SELECT COALESCE(jsonb_object_agg(reason, n), '{}'::jsonb)
  INTO v_reasons
  FROM (
    SELECT COALESCE(reason, 'unknown') AS reason, count(*) AS n
    FROM public.redemption_events
    WHERE created_at >= v_since
    GROUP BY reason
  ) r;

  -- Hourly bucket series for the chart.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'bucket', bucket,
           'total', total,
           'success', success,
           'failure', failure,
           'rate_limit', rate_limit
         ) ORDER BY bucket), '[]'::jsonb)
  INTO v_hourly
  FROM (
    SELECT
      date_trunc('hour', created_at) AS bucket,
      count(*) AS total,
      count(*) FILTER (WHERE outcome = 'success') AS success,
      count(*) FILTER (WHERE status >= 400 AND outcome <> 'idempotent_replay') AS failure,
      count(*) FILTER (
        WHERE outcome IN ('request_too_large', 'invalid_idempotency_key', 'invalid_code_format')
           OR reason IN ('request_too_large', 'invalid_idempotency_key')
      ) AS rate_limit
    FROM public.redemption_events
    WHERE created_at >= v_since
    GROUP BY 1
  ) h;

  RETURN jsonb_build_object(
    'window_hours', p_hours,
    'since', v_since,
    'totals', jsonb_build_object(
      'attempts', COALESCE(v_total, 0),
      'success', COALESCE(v_success, 0),
      'failure', COALESCE(v_failure, 0),
      'rate_limit', COALESCE(v_rate_limit, 0),
      'idempotent_replays', COALESCE(v_replays, 0),
      'unique_users', COALESCE(v_unique_users, 0)
    ),
    'latency_ms', jsonb_build_object(
      'p50', COALESCE(v_p50, 0),
      'p95', COALESCE(v_p95, 0)
    ),
    'outcomes', v_outcomes,
    'reasons', v_reasons,
    'hourly', v_hourly
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_redemption_metrics_24h(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_redemption_metrics_24h(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_redemption_events() TO service_role;
