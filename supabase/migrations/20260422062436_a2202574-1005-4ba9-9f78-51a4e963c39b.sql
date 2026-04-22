-- 0. Ensure pgcrypto is available for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Add hashed columns
ALTER TABLE public.access_codes
  ADD COLUMN IF NOT EXISTS code_hash text,
  ADD COLUMN IF NOT EXISTS code_prefix text;

-- 2. Backfill from existing plaintext code
UPDATE public.access_codes
SET
  code_hash = encode(extensions.digest(code, 'sha256'), 'hex'),
  code_prefix = substring(code from 1 for 8)
WHERE code_hash IS NULL;

-- 3. Make hashed columns required and unique
ALTER TABLE public.access_codes
  ALTER COLUMN code_hash SET NOT NULL,
  ALTER COLUMN code_prefix SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS access_codes_code_hash_key
  ON public.access_codes (code_hash);

-- 4. Drop plaintext code column
ALTER TABLE public.access_codes DROP COLUMN IF EXISTS code;

-- 5. RPC: create access code (system admins only)
CREATE OR REPLACE FUNCTION public.create_access_code(
  p_code text,
  p_description text,
  p_tier text,
  p_duration_days integer,
  p_valid_from date,
  p_valid_until date,
  p_max_uses integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_code text := upper(trim(p_code));
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF length(v_code) < 3 OR length(v_code) > 50 THEN
    RAISE EXCEPTION 'Invalid code length';
  END IF;

  INSERT INTO public.access_codes (
    code_hash, code_prefix, description, tier, duration_days,
    valid_from, valid_until, max_uses, created_by
  )
  VALUES (
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    substring(v_code from 1 for 8),
    p_description, p_tier, p_duration_days,
    p_valid_from, p_valid_until, p_max_uses, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 6. RPC: lookup by plaintext (used by redeem edge function via service role)
CREATE OR REPLACE FUNCTION public.lookup_access_code_by_plaintext(p_code text)
RETURNS SETOF public.access_codes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT *
  FROM public.access_codes
  WHERE code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  LIMIT 1;
$$;

-- 7. Tenant-visible view (no hash exposed)
CREATE OR REPLACE VIEW public.access_codes_redeemed_view
WITH (security_invoker = true) AS
SELECT
  ac.id,
  ac.code_prefix,
  ac.description,
  ac.tier,
  ac.duration_days,
  ac.valid_from,
  ac.valid_until,
  ac.max_uses,
  ac.used_count,
  ac.is_active,
  ac.is_revoked,
  ac.revoked_at,
  ac.revoked_reason,
  ac.created_at,
  ac.updated_at,
  acr.tenant_id AS redeemed_by_tenant_id,
  acr.granted_until,
  acr.granted_tier,
  acr.is_active AS redemption_active
FROM public.access_codes ac
JOIN public.access_code_redemptions acr ON acr.access_code_id = ac.id;

GRANT SELECT ON public.access_codes_redeemed_view TO authenticated;

-- 8. Tenant SELECT policy on access_codes (only for codes their workspace has redeemed)
DROP POLICY IF EXISTS "Tenants can view their redeemed access codes" ON public.access_codes;
CREATE POLICY "Tenants can view their redeemed access codes"
  ON public.access_codes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.access_code_redemptions acr
      WHERE acr.access_code_id = access_codes.id
        AND acr.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- 9. Restrict RPC execution
REVOKE EXECUTE ON FUNCTION public.lookup_access_code_by_plaintext(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_access_code_by_plaintext(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_access_code(text, text, text, integer, date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_access_code(text, text, text, integer, date, date, integer) TO authenticated, service_role;