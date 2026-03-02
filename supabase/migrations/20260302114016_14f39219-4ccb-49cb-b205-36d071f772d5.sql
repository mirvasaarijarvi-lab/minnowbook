
CREATE TABLE public.recurring_blocked_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  resource_type text NOT NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE CASCADE,
  start_time time without time zone,
  end_time time without time zone,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.recurring_blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant recurring blocked slots"
  ON public.recurring_blocked_slots FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners/admins can manage recurring blocked slots"
  ON public.recurring_blocked_slots FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Public can view recurring blocked slots for booking"
  ON public.recurring_blocked_slots FOR SELECT
  TO anon, authenticated
  USING (true);
