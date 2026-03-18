
CREATE TABLE public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  page_context text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
ON public.beta_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
ON public.beta_feedback
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- System admins can view all feedback
CREATE POLICY "System admins can manage all feedback"
ON public.beta_feedback
FOR ALL
TO public
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));
