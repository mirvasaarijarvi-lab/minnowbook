CREATE TABLE public.special_occasions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  reservation_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  occasion_date DATE NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 50,
  booking_type TEXT NOT NULL DEFAULT 'seatings' CHECK (booking_type IN ('seatings', 'open')),
  seating_times JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_special_occasions_tenant_date ON public.special_occasions (tenant_id, occasion_date);

GRANT SELECT ON public.special_occasions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_occasions TO authenticated;
GRANT ALL ON public.special_occasions TO service_role;

ALTER TABLE public.special_occasions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active special occasions"
ON public.special_occasions FOR SELECT TO anon
USING (is_active = true AND is_tenant_active(tenant_id));

CREATE POLICY "Users can view their tenant special occasions"
ON public.special_occasions FOR SELECT TO authenticated
USING (is_user_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Owners/admins can manage special occasions"
ON public.special_occasions FOR ALL TO authenticated
USING (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id) OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
)
WITH CHECK (
  is_user_tenant_member(auth.uid(), tenant_id)
  AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id) OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
);

CREATE POLICY "System admins can manage all special occasions"
ON public.special_occasions FOR ALL TO public
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_special_occasions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_special_occasions_updated_at
BEFORE UPDATE ON public.special_occasions
FOR EACH ROW EXECUTE FUNCTION public.set_special_occasions_updated_at();

ALTER TABLE public.reservations ADD COLUMN special_occasion_id UUID REFERENCES public.special_occasions(id) ON DELETE SET NULL;
ALTER TABLE public.archived_reservations ADD COLUMN special_occasion_id UUID;

CREATE INDEX idx_reservations_special_occasion ON public.reservations (special_occasion_id);
