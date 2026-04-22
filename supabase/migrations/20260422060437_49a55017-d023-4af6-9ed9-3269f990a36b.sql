-- Kitchen menu templates: reusable items per tenant
CREATE TABLE public.kitchen_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'food',
  unit_price_eur numeric(10,2),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kitchen_menu_items_tenant ON public.kitchen_menu_items(tenant_id, is_active, sort_order);

ALTER TABLE public.kitchen_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view menu items"
  ON public.kitchen_menu_items FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can insert menu items"
  ON public.kitchen_menu_items FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can update menu items"
  ON public.kitchen_menu_items FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can delete menu items"
  ON public.kitchen_menu_items FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "System admins can manage all menu items"
  ON public.kitchen_menu_items FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE TRIGGER set_kitchen_menu_items_updated_at
BEFORE UPDATE ON public.kitchen_menu_items
FOR EACH ROW EXECUTE FUNCTION public.set_kitchen_orders_updated_at();