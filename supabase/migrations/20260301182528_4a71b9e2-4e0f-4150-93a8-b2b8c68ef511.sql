
-- Login history table
CREATE TABLE public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  logged_in_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_login_history_tenant_user ON public.login_history(tenant_id, user_id, logged_in_at DESC);

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own login records
CREATE POLICY "Users can insert own login history"
  ON public.login_history FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

-- Owners/admins can view all login history for their tenant
CREATE POLICY "Owners/admins can view tenant login history"
  ON public.login_history FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
  );

-- Users can view their own login history
CREATE POLICY "Users can view own login history"
  ON public.login_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
