CREATE TABLE public.guest_portal_rate_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.guest_portal_rate_limits IS 'Shared per-person request counts for guest-booking-portal. bucket_key is a SHA-256 hash of the caller address; raw addresses are never stored.';

GRANT ALL ON public.guest_portal_rate_limits TO service_role;
ALTER TABLE public.guest_portal_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active accounts only" ON public.guest_portal_rate_limits
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_account_active(auth.uid()))
  WITH CHECK (public.is_account_active(auth.uid()));

CREATE OR REPLACE FUNCTION public.consume_guest_portal_rate_limit(
  _bucket_key text, _max integer, _window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  IF _bucket_key IS NULL OR length(_bucket_key) < 16 OR _max < 1 OR _window_seconds < 1 THEN
    RETURN false;
  END IF;
  INSERT INTO public.guest_portal_rate_limits AS r (bucket_key, window_start, request_count)
  VALUES (_bucket_key, now(), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET request_count = CASE WHEN r.window_start <= now() - make_interval(secs => _window_seconds)
                             THEN 1 ELSE r.request_count + 1 END,
        window_start  = CASE WHEN r.window_start <= now() - make_interval(secs => _window_seconds)
                             THEN now() ELSE r.window_start END
  RETURNING request_count INTO _count;
  IF random() < 0.01 THEN
    DELETE FROM public.guest_portal_rate_limits WHERE window_start < now() - interval '1 hour';
  END IF;
  RETURN _count <= _max;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_guest_portal_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guest_portal_rate_limit(text, integer, integer) TO service_role;