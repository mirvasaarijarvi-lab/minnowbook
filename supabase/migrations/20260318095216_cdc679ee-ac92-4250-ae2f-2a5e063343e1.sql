
-- Access codes table for beta testers
CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  tier text NOT NULL DEFAULT 'business',
  duration_days integer NOT NULL DEFAULT 30,
  valid_from date,
  valid_until date,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  revoked_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Track which tenants redeemed which codes
CREATE TABLE public.access_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code_id uuid NOT NULL REFERENCES public.access_codes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  redeemed_by uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  granted_tier text NOT NULL,
  granted_until date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  UNIQUE(access_code_id, tenant_id)
);

-- RLS for access_codes: only system admins can manage
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can manage access codes"
  ON public.access_codes FOR ALL
  TO public
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- RLS for access_code_redemptions
ALTER TABLE public.access_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can manage all redemptions"
  ON public.access_code_redemptions FOR ALL
  TO public
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant owners can view their redemptions"
  ON public.access_code_redemptions FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
