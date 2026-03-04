
CREATE TABLE public.resource_opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time time,
  close_time time,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(resource_id, day_of_week)
);

ALTER TABLE public.resource_opening_hours ENABLE ROW LEVEL SECURITY;

-- Public can view (for booking page)
CREATE POLICY "Public can view resource opening hours"
ON public.resource_opening_hours FOR SELECT
USING (true);

-- Owners/admins can manage
CREATE POLICY "Owners/admins can manage resource opening hours"
ON public.resource_opening_hours FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
);

-- System admins can manage all
CREATE POLICY "System admins can manage all resource opening hours"
ON public.resource_opening_hours FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));
