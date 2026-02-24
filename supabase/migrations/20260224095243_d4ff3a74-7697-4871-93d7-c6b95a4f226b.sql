
-- Create resource_images table for multi-image gallery
CREATE TABLE public.resource_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_resource_images_resource ON public.resource_images(resource_id);

-- Enable RLS
ALTER TABLE public.resource_images ENABLE ROW LEVEL SECURITY;

-- Owners/admins can manage images
CREATE POLICY "Owners/admins can manage resource images"
  ON public.resource_images
  FOR ALL
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin'))
  );

-- Staff can view
CREATE POLICY "Users can view their tenant resource images"
  ON public.resource_images
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Public can view for booking pages
CREATE POLICY "Public can view resource images"
  ON public.resource_images
  FOR SELECT
  USING (true);
