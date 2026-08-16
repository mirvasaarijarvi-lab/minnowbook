CREATE TABLE public.reschedule_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  requested_start_time time without time zone,
  requested_end_time time without time zone,
  guest_note text,
  status text NOT NULL DEFAULT 'pending',
  staff_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reschedule_requests_status_check CHECK (status IN ('pending','approved','declined','cancelled'))
);

CREATE INDEX idx_reschedule_requests_tenant_status ON public.reschedule_requests (tenant_id, status, created_at DESC);
CREATE INDEX idx_reschedule_requests_reservation ON public.reschedule_requests (reservation_id);

GRANT SELECT, UPDATE ON public.reschedule_requests TO authenticated;
GRANT ALL ON public.reschedule_requests TO service_role;

ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view reschedule requests"
ON public.reschedule_requests
FOR SELECT
TO authenticated
USING (public.is_user_tenant_member(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()));

CREATE POLICY "Tenant staff can review reschedule requests"
ON public.reschedule_requests
FOR UPDATE
TO authenticated
USING (public.is_user_tenant_member(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()))
WITH CHECK (public.is_user_tenant_member(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_reschedule_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_reschedule_requests_updated_at
BEFORE UPDATE ON public.reschedule_requests
FOR EACH ROW EXECUTE FUNCTION public.set_reschedule_requests_updated_at();