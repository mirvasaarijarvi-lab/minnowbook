
-- 1. Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing',
  tier TEXT NOT NULL DEFAULT 'basic',
  allowed_reservation_types TEXT[] NOT NULL DEFAULT '{}',
  max_staff_users INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create tenant_settings table
CREATE TABLE public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT,
  accent_color TEXT,
  hero_image_url TEXT,
  business_name TEXT,
  business_description TEXT,
  business_address TEXT,
  business_phone TEXT,
  business_email TEXT,
  default_language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'Europe/Helsinki',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- 3. Create tenant_opening_hours table
CREATE TABLE public.tenant_opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create tenant_email_templates table
CREATE TABLE public.tenant_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create app_role enum and tenant_users table
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'staff');

CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  is_approved BOOLEAN DEFAULT false,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 6. Create resources table
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  description TEXT,
  capacity INTEGER,
  price_per_night NUMERIC,
  breakfast_price_per_person NUMERIC DEFAULT 15.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reservation_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  check_out_date DATE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  guests_count INTEGER,
  estimated_guests INTEGER,
  room_type TEXT,
  event_type TEXT,
  special_requests TEXT,
  catering_needed BOOLEAN DEFAULT false,
  accommodation_needed BOOLEAN DEFAULT false,
  breakfast_included BOOLEAN DEFAULT false,
  breakfast_price_per_person NUMERIC DEFAULT 15.00,
  price_eur NUMERIC,
  pricing_details TEXT,
  staff_notes TEXT,
  internal_notes TEXT,
  is_invoiced BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en',
  no_email_ack BOOLEAN DEFAULT false,
  no_email_confirm BOOLEAN DEFAULT false,
  no_email_cancel BOOLEAN DEFAULT false,
  acknowledgment_email_sent_at TIMESTAMPTZ,
  confirmation_email_sent_at TIMESTAMPTZ,
  cancellation_email_sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Create blocked_slots table
CREATE TABLE public.blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID REFERENCES public.resources(id),
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

-- 10. Security definer function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users WHERE user_id = p_user_id LIMIT 1;
$$;

-- 11. Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_tenant_role(p_user_id UUID, p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = p_user_id AND role = p_role
  );
$$;

-- 12. RLS policies for tenants
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT TO authenticated
  USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can update their tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (id = public.get_user_tenant_id(auth.uid()) AND public.has_tenant_role(auth.uid(), 'owner'));

-- 13. RLS policies for tenant_settings
CREATE POLICY "Users can view their tenant settings"
  ON public.tenant_settings FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage tenant settings"
  ON public.tenant_settings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_tenant_role(auth.uid(), 'owner'));

-- Public read for booking pages
CREATE POLICY "Public can view tenant settings for booking"
  ON public.tenant_settings FOR SELECT TO anon
  USING (true);

-- 14. RLS policies for tenant_opening_hours
CREATE POLICY "Users can view their tenant opening hours"
  ON public.tenant_opening_hours FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners/admins can manage opening hours"
  ON public.tenant_opening_hours FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'owner') OR public.has_tenant_role(auth.uid(), 'admin')));

CREATE POLICY "Public can view opening hours for booking"
  ON public.tenant_opening_hours FOR SELECT TO anon
  USING (true);

-- 15. RLS policies for tenant_email_templates
CREATE POLICY "Users can view their tenant email templates"
  ON public.tenant_email_templates FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage email templates"
  ON public.tenant_email_templates FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_tenant_role(auth.uid(), 'owner'));

-- 16. RLS policies for tenant_users
CREATE POLICY "Users can view their tenant members"
  ON public.tenant_users FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage tenant users"
  ON public.tenant_users FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_tenant_role(auth.uid(), 'owner'));

-- 17. RLS policies for resources
CREATE POLICY "Users can view their tenant resources"
  ON public.resources FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners/admins can manage resources"
  ON public.resources FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'owner') OR public.has_tenant_role(auth.uid(), 'admin')));

CREATE POLICY "Public can view active resources for booking"
  ON public.resources FOR SELECT TO anon
  USING (is_active = true);

-- 18. RLS policies for reservations
CREATE POLICY "Users can view their tenant reservations"
  ON public.reservations FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff can manage reservations"
  ON public.reservations FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Anonymous can create reservations (public booking)
CREATE POLICY "Public can create reservations"
  ON public.reservations FOR INSERT TO anon
  WITH CHECK (true);

-- 19. RLS policies for blocked_slots
CREATE POLICY "Users can view their tenant blocked slots"
  ON public.blocked_slots FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners/admins can manage blocked slots"
  ON public.blocked_slots FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'owner') OR public.has_tenant_role(auth.uid(), 'admin')));

CREATE POLICY "Public can view blocked slots for booking"
  ON public.blocked_slots FOR SELECT TO anon
  USING (true);

-- 20. Public read policy for tenants (needed for slug lookup on booking pages)
CREATE POLICY "Public can view active tenants"
  ON public.tenants FOR SELECT TO anon
  USING (is_active = true);
