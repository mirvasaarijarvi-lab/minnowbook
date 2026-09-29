CREATE TABLE public.guest_portal_limit_events (
  minute timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('refused','db_error')),
  event_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (minute, kind)
);
GRANT ALL ON public.guest_portal_limit_events TO service_role;
ALTER TABLE public.guest_portal_limit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System admins read limit events" ON public.guest_portal_limit_events
  FOR SELECT TO authenticated USING (public.is_system_admin(auth.uid()));
CREATE POLICY "Active accounts only" ON public.guest_portal_limit_events
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_account_active(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_guest_portal_limit_event(_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind NOT IN ('refused','db_error') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  INSERT INTO public.guest_portal_limit_events(minute, kind, event_count)
  VALUES (date_trunc('minute', now()), _kind, 1)
  ON CONFLICT (minute, kind) DO UPDATE SET event_count = guest_portal_limit_events.event_count + 1;
  DELETE FROM public.guest_portal_limit_events WHERE minute < now() - interval '30 days';
END $$;
REVOKE ALL ON FUNCTION public.record_guest_portal_limit_event(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_guest_portal_limit_event(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_guest_portal_limit_health()
RETURNS TABLE(refused_1h bigint, refused_24h bigint, db_errors_1h bigint, db_errors_24h bigint, last_db_error_at timestamptz, last_refused_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT
    coalesce(sum(event_count) FILTER (WHERE kind='refused' AND minute >= now()-interval '1 hour'),0)::bigint,
    coalesce(sum(event_count) FILTER (WHERE kind='refused' AND minute >= now()-interval '24 hours'),0)::bigint,
    coalesce(sum(event_count) FILTER (WHERE kind='db_error' AND minute >= now()-interval '1 hour'),0)::bigint,
    coalesce(sum(event_count) FILTER (WHERE kind='db_error' AND minute >= now()-interval '24 hours'),0)::bigint,
    max(minute) FILTER (WHERE kind='db_error'),
    max(minute) FILTER (WHERE kind='refused')
  FROM public.guest_portal_limit_events;
END $$;
REVOKE ALL ON FUNCTION public.get_guest_portal_limit_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_guest_portal_limit_health() TO authenticated;