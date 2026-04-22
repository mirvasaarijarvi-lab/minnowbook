
-- Idempotency cache for the redeem-access-code endpoint.
-- Keyed by (user_id, idempotency_key) so the same caller replaying the same
-- key always gets back the same outcome rather than triggering a second
-- redemption (which would double-bump used_count or fail with a confusing
-- "already redeemed" error).
--
-- We store the full response (status + body) the first call produced. The
-- edge function checks this table before doing any state mutation; if a
-- row exists for (auth.uid(), key), it short-circuits and replays the
-- stored response verbatim.
--
-- Rows are server-managed only (service_role from the edge function).
-- No direct authenticated/anon access is needed — the cache is invisible
-- to clients, who just observe consistent retries.
CREATE TABLE IF NOT EXISTS public.redemption_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  endpoint text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT redemption_idempotency_user_key_endpoint_uniq
    UNIQUE (user_id, idempotency_key, endpoint),
  CONSTRAINT redemption_idempotency_key_length_chk
    CHECK (char_length(idempotency_key) BETWEEN 16 AND 128)
);

CREATE INDEX IF NOT EXISTS redemption_idempotency_expires_at_idx
  ON public.redemption_idempotency (expires_at);

ALTER TABLE public.redemption_idempotency ENABLE ROW LEVEL SECURITY;

-- Service role manages everything via the edge function.
DROP POLICY IF EXISTS "Service role manages idempotency cache"
  ON public.redemption_idempotency;
CREATE POLICY "Service role manages idempotency cache"
  ON public.redemption_idempotency
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Block anon and authenticated entirely — clients have no business reading
-- or writing the cache directly. This keeps the cache invisible and means
-- it never shows up as tenant data in cross-tenant tests.
DROP POLICY IF EXISTS "Block anon from idempotency cache"
  ON public.redemption_idempotency;
CREATE POLICY "Block anon from idempotency cache"
  ON public.redemption_idempotency
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block authenticated from idempotency cache"
  ON public.redemption_idempotency;
CREATE POLICY "Block authenticated from idempotency cache"
  ON public.redemption_idempotency
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Cleanup helper for stale rows (called by a future cron if needed).
CREATE OR REPLACE FUNCTION public.cleanup_expired_redemption_idempotency()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.redemption_idempotency
  WHERE expires_at < now();
END;
$$;
