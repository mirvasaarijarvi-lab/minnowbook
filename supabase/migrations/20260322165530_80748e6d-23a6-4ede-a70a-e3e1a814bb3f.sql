-- Table for hashed MFA recovery codes
CREATE TABLE public.mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can only read their own codes (to check count remaining)
CREATE POLICY "Users can view own recovery codes"
ON public.mfa_recovery_codes FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Only service role can insert/update (via edge function)
CREATE POLICY "Service role can manage recovery codes"
ON public.mfa_recovery_codes FOR ALL TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Index for fast lookup
CREATE INDEX idx_mfa_recovery_codes_user ON public.mfa_recovery_codes (user_id, is_used);