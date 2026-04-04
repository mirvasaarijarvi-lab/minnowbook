
-- Create booking_tokens table for guest portal magic links
CREATE TABLE public.booking_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  is_revoked boolean NOT NULL DEFAULT false
);

-- Index for fast token lookup
CREATE INDEX idx_booking_tokens_token ON public.booking_tokens (token);
CREATE INDEX idx_booking_tokens_reservation ON public.booking_tokens (reservation_id);

-- Enable RLS
ALTER TABLE public.booking_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone with the token can view it (public access for guest portal)
CREATE POLICY "Anyone can view by token" ON public.booking_tokens
  FOR SELECT USING (true);

-- Tenant staff can manage tokens
CREATE POLICY "Staff can manage booking tokens" ON public.booking_tokens
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- System admins full access
CREATE POLICY "System admins can manage all booking tokens" ON public.booking_tokens
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Create guest_reviews table for Feature 13
CREATE TABLE public.guest_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid,
  tenant_id uuid NOT NULL,
  site_id uuid,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  is_published boolean NOT NULL DEFAULT false,
  review_token text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_reviews_tenant ON public.guest_reviews (tenant_id);
CREATE INDEX idx_guest_reviews_token ON public.guest_reviews (review_token);

ALTER TABLE public.guest_reviews ENABLE ROW LEVEL SECURITY;

-- Public can view published reviews
CREATE POLICY "Public can view published reviews" ON public.guest_reviews
  FOR SELECT USING (is_published = true);

-- Anyone with token can insert a review
CREATE POLICY "Anyone can submit review with token" ON public.guest_reviews
  FOR INSERT WITH CHECK (review_token IS NOT NULL);

-- Tenant staff can manage reviews
CREATE POLICY "Staff can manage reviews" ON public.guest_reviews
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- System admins full access
CREATE POLICY "System admins can manage all reviews" ON public.guest_reviews
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Create waitlist table for Feature 3
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  site_id uuid,
  resource_type text NOT NULL,
  preferred_date date NOT NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text,
  status text NOT NULL DEFAULT 'waiting',
  notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_tenant_date ON public.waitlist (tenant_id, preferred_date);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Public can join waitlist for active tenants
CREATE POLICY "Public can join waitlist" ON public.waitlist
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenants WHERE id = waitlist.tenant_id AND is_active = true
  ));

-- Tenant staff can manage waitlist
CREATE POLICY "Staff can manage waitlist" ON public.waitlist
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- System admins full access
CREATE POLICY "System admins can manage all waitlist" ON public.waitlist
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));
