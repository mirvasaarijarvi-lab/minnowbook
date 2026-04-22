-- Kitchen orders: lite version
CREATE TABLE public.kitchen_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  category TEXT NOT NULL DEFAULT 'food' CHECK (category IN ('food', 'drink', 'other')),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'preparing', 'ready', 'served')),
  notes TEXT,
  unit_price_eur NUMERIC(10, 2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kitchen_orders_tenant_reservation
  ON public.kitchen_orders (tenant_id, reservation_id);

CREATE INDEX idx_kitchen_orders_reservation
  ON public.kitchen_orders (reservation_id);

ALTER TABLE public.kitchen_orders ENABLE ROW LEVEL SECURITY;

-- Tenant members can view their tenant's kitchen orders
CREATE POLICY "Tenant members can view kitchen orders"
ON public.kitchen_orders
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Tenant staff can manage kitchen orders for their tenant
CREATE POLICY "Tenant members can insert kitchen orders"
ON public.kitchen_orders
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can update kitchen orders"
ON public.kitchen_orders
FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can delete kitchen orders"
ON public.kitchen_orders
FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- System admins can manage all
CREATE POLICY "System admins can manage all kitchen orders"
ON public.kitchen_orders
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_kitchen_orders_updated_at()
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

CREATE TRIGGER kitchen_orders_updated_at
BEFORE UPDATE ON public.kitchen_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_kitchen_orders_updated_at();