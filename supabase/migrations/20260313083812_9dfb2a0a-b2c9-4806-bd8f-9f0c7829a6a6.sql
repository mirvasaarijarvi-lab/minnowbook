
-- Create archived_reservations table with same structure as reservations + archived_at timestamp
CREATE TABLE public.archived_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  site_id uuid REFERENCES public.sites(id),
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text,
  reservation_type text NOT NULL,
  restaurant_sub_type text DEFAULT 'dine_in'::text,
  date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  check_out_date date,
  guests_count integer,
  estimated_guests integer,
  status text DEFAULT 'pending'::text,
  price_eur numeric,
  original_price_eur numeric,
  discount_value numeric,
  discount_type text,
  discount_reason text,
  discount_code_id uuid,
  pricing_type text,
  pricing_details text,
  is_invoiced boolean DEFAULT false,
  is_used boolean DEFAULT false,
  is_checked_in boolean DEFAULT false,
  special_requests text,
  internal_notes text,
  staff_notes text,
  dietary_notes text,
  event_type text,
  room_type text,
  accommodation_needed boolean DEFAULT false,
  breakfast_included boolean DEFAULT false,
  breakfast_price_per_person numeric DEFAULT 15.00,
  catering_needed boolean DEFAULT false,
  equipment_needed boolean DEFAULT false,
  staff_needed boolean DEFAULT false,
  electricity_needed boolean DEFAULT false,
  water_needed boolean DEFAULT false,
  stall_size text,
  stall_fee numeric,
  festival_name text,
  food_permits text,
  delivery_address text,
  language text DEFAULT 'en'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  acknowledgment_email_sent_at timestamp with time zone,
  confirmation_email_sent_at timestamp with time zone,
  cancellation_email_sent_at timestamp with time zone,
  reminder_email_sent_at timestamp with time zone,
  no_email_ack boolean DEFAULT false,
  no_email_confirm boolean DEFAULT false,
  no_email_cancel boolean DEFAULT false,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  original_reservation_id uuid NOT NULL
);

-- Index for cleanup queries
CREATE INDEX idx_archived_reservations_archived_at ON public.archived_reservations(archived_at);
CREATE INDEX idx_archived_reservations_tenant_id ON public.archived_reservations(tenant_id);

-- Enable RLS
ALTER TABLE public.archived_reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies mirror reservations table
CREATE POLICY "Staff can view archived reservations"
  ON public.archived_reservations FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners/admins can manage archived reservations"
  ON public.archived_reservations FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)
    )
  );

CREATE POLICY "System admins can manage all archived reservations"
  ON public.archived_reservations FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));
