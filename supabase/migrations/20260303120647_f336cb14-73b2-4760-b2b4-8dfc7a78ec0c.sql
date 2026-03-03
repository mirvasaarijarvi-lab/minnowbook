-- Add discount fields to reservations
ALTER TABLE public.reservations
  ADD COLUMN discount_type text DEFAULT NULL,
  ADD COLUMN discount_value numeric DEFAULT NULL,
  ADD COLUMN discount_reason text DEFAULT NULL,
  ADD COLUMN discount_code_id uuid DEFAULT NULL,
  ADD COLUMN original_price_eur numeric DEFAULT NULL;

COMMENT ON COLUMN public.reservations.discount_type IS 'percentage, fixed, or free_nights';
COMMENT ON COLUMN public.reservations.discount_value IS 'Discount amount (% or EUR depending on type)';
COMMENT ON COLUMN public.reservations.discount_reason IS 'Staff note explaining the discount';
COMMENT ON COLUMN public.reservations.discount_code_id IS 'Reference to discount_codes if a promo code was used';
COMMENT ON COLUMN public.reservations.original_price_eur IS 'Price before discount was applied';

-- Create discount_codes table
CREATE TABLE public.discount_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  min_price_eur numeric DEFAULT NULL,
  max_uses integer DEFAULT NULL,
  used_count integer NOT NULL DEFAULT 0,
  valid_from date DEFAULT NULL,
  valid_until date DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  applies_to text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_type_check CHECK (discount_type IN ('percentage', 'fixed', 'free_nights')),
  CONSTRAINT discount_codes_value_positive CHECK (discount_value >= 0),
  UNIQUE (tenant_id, code)
);

COMMENT ON COLUMN public.discount_codes.applies_to IS 'Reservation types this code applies to (empty = all)';
COMMENT ON COLUMN public.discount_codes.discount_type IS 'percentage, fixed, or free_nights';

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Owners/admins can manage discount codes
CREATE POLICY "Owners/admins can manage discount codes"
ON public.discount_codes
FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
);

-- Staff can view discount codes
CREATE POLICY "Staff can view discount codes"
ON public.discount_codes
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Public can view active codes for validation
CREATE POLICY "Public can view active discount codes"
ON public.discount_codes
FOR SELECT
USING (is_active = true);