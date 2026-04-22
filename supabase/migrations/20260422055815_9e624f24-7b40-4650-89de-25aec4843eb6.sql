-- Booking validation log: records every reservation creation attempt with capacity context
CREATE TABLE public.booking_validation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  site_id UUID,
  source TEXT NOT NULL, -- 'public_booking' | 'manual_dashboard' | 'public_booking_v2' etc
  reservation_type TEXT,
  reservation_date DATE,
  start_time TIME,
  guest_name TEXT,
  guest_email TEXT,
  guests_requested INTEGER,
  current_load INTEGER, -- guests already booked for that date+type+site
  capacity_total INTEGER, -- sum of capacity of matching active resources
  outcome TEXT NOT NULL, -- 'accepted' | 'soft_warning' | 'rejected'
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of strings explaining decision
  reservation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bvl_tenant_created ON public.booking_validation_log (tenant_id, created_at DESC);
CREATE INDEX idx_bvl_outcome ON public.booking_validation_log (tenant_id, outcome, created_at DESC);

ALTER TABLE public.booking_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins can view validation log"
ON public.booking_validation_log
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
       OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
);

CREATE POLICY "Tenant members can insert validation log"
ON public.booking_validation_log
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "System admins can manage validation log"
ON public.booking_validation_log
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Auto-cleanup function (30 days retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_booking_validation_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.booking_validation_log
  WHERE created_at < now() - interval '30 days';
END;
$$;