-- Create offers table
CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  validity_date text,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text NOT NULL,
  event_date date NOT NULL,
  start_time text NOT NULL,
  end_time text,
  guests_count integer NOT NULL,
  event_space text NOT NULL DEFAULT '',
  event_type text,
  invoicing_details text,
  special_requests text,
  menu text,
  linked_reservations jsonb,
  reservation_ids uuid[],
  created_by uuid,
  language text NOT NULL DEFAULT 'en',
  archived_at timestamp with time zone,
  last_sent_at timestamp with time zone,
  last_send_provider_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT offers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Owners/admins can manage offers"
ON public.offers FOR ALL
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (
    has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
  )
);

CREATE POLICY "Staff can view offers"
ON public.offers FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "System admins can manage all offers"
ON public.offers FOR ALL
TO public
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Index for performance
CREATE INDEX idx_offers_tenant_id ON public.offers(tenant_id);
CREATE INDEX idx_offers_status ON public.offers(status);

-- Add audit trigger
CREATE TRIGGER audit_offers
AFTER INSERT OR UPDATE OR DELETE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();