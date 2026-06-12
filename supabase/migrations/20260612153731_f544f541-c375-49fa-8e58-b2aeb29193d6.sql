-- =========================================================
-- Phase 3: self-service GDPR rights (export + deletion)
-- =========================================================

-- ------- pending_account_deletions --------
CREATE TABLE IF NOT EXISTS public.pending_account_deletions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancel_token text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','cancelled','purged','failed')),
  reason text,
  cancelled_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_account_deletions_purge_after
  ON public.pending_account_deletions (purge_after)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_account_deletions TO authenticated;
GRANT ALL ON public.pending_account_deletions TO service_role;

ALTER TABLE public.pending_account_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see their own deletion request"
  ON public.pending_account_deletions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users insert their own deletion request"
  ON public.pending_account_deletions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users cancel their own deletion request"
  ON public.pending_account_deletions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------- data_export_requests --------
CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  byte_size bigint,
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed','failed'))
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_created
  ON public.data_export_requests (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.data_export_requests TO authenticated;
GRANT ALL ON public.data_export_requests TO service_role;

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see their own export requests"
  ON public.data_export_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users insert their own export requests"
  ON public.data_export_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ------- updated_at trigger for pending_account_deletions --------
CREATE OR REPLACE FUNCTION public.set_pending_account_deletions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_account_deletions_updated_at
  ON public.pending_account_deletions;
CREATE TRIGGER trg_pending_account_deletions_updated_at
  BEFORE UPDATE ON public.pending_account_deletions
  FOR EACH ROW EXECUTE FUNCTION public.set_pending_account_deletions_updated_at();
