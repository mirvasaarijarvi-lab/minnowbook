
-- Support requests table for Business tier escalation
CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  responded_at timestamptz,
  is_read_by_user boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own tenant's requests
CREATE POLICY "Users can view their tenant support requests"
ON public.support_requests FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Owners/admins can manage (respond to) support requests
CREATE POLICY "Owners/admins can manage support requests"
ON public.support_requests FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
);

-- Any authenticated user in the tenant can create requests
CREATE POLICY "Users can create support requests"
ON public.support_requests FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND user_id = auth.uid()
);
