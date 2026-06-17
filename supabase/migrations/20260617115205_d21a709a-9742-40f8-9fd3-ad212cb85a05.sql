-- Per-resource occasional working slots (positive availability windows for sporadic workers).
-- Complements resource_opening_hours (weekly recurring schedule).
CREATE TABLE IF NOT EXISTS public.resource_availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_avail_slots_resource_date
  ON public.resource_availability_slots (resource_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_resource_avail_slots_tenant_date
  ON public.resource_availability_slots (tenant_id, slot_date);

-- GRANTS: anon SELECT for public booking availability lookup, authenticated full CRUD via RLS,
-- service_role for edge functions.
GRANT SELECT ON public.resource_availability_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_availability_slots TO authenticated;
GRANT ALL ON public.resource_availability_slots TO service_role;

ALTER TABLE public.resource_availability_slots ENABLE ROW LEVEL SECURITY;

-- Anon: SELECT only for active tenants (mirrors resource_opening_hours pattern).
CREATE POLICY "anon read avail slots for active tenants"
  ON public.resource_availability_slots FOR SELECT TO anon
  USING (public.is_tenant_active(tenant_id));

-- Authenticated: read your own tenant's slots.
CREATE POLICY "members read their tenant avail slots"
  ON public.resource_availability_slots FOR SELECT TO authenticated
  USING (public.is_user_tenant_member(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()));

-- Authenticated: manage requires resources.manage permission.
CREATE POLICY "members manage avail slots with permission"
  ON public.resource_availability_slots FOR ALL TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'resources.manage', tenant_id)
  )
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'resources.manage', tenant_id)
  );

-- Validation trigger: end_time > start_time, slot_date not in distant past, resource belongs to tenant.
CREATE OR REPLACE FUNCTION public.validate_resource_availability_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_resource_tenant uuid;
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'end_time must be after start_time';
  END IF;

  IF NEW.slot_date < (now() AT TIME ZONE 'UTC')::date - interval '1 day' THEN
    RAISE EXCEPTION 'slot_date cannot be in the past';
  END IF;

  SELECT tenant_id INTO v_resource_tenant
  FROM public.resources WHERE id = NEW.resource_id;

  IF v_resource_tenant IS NULL THEN
    RAISE EXCEPTION 'resource_id % does not exist', NEW.resource_id;
  END IF;

  IF v_resource_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'resource_id does not belong to tenant_id';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_validate_resource_availability_slot
  BEFORE INSERT OR UPDATE ON public.resource_availability_slots
  FOR EACH ROW EXECUTE FUNCTION public.validate_resource_availability_slot();