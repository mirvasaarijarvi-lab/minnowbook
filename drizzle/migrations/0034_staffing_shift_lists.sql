CREATE OR REPLACE FUNCTION public.set_staffing_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.is_tenant_manager(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_tenant_role(p_user_id, 'owner', p_tenant_id)
      OR public.has_tenant_role(p_user_id, 'admin', p_tenant_id)
      OR public.is_system_admin(p_user_id);
$$;
REVOKE ALL ON FUNCTION public.is_tenant_manager(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_tenant_manager(uuid, uuid) TO authenticated;

CREATE TABLE public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 60),
  name_en text NOT NULL CHECK (length(name_en) BETWEEN 1 AND 80),
  name_fi text NOT NULL CHECK (length(name_fi) BETWEEN 1 AND 80),
  name_sv text NOT NULL CHECK (length(name_sv) BETWEEN 1 AND 80),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_roles TO authenticated;
GRANT ALL ON public.staff_roles TO service_role;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read staff roles" ON public.staff_roles FOR SELECT TO authenticated USING (public.is_user_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers insert staff roles" ON public.staff_roles FOR INSERT TO authenticated WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers update staff roles" ON public.staff_roles FOR UPDATE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers delete staff roles" ON public.staff_roles FOR DELETE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id));

CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  role_keys text[] NOT NULL DEFAULT '{}',
  employment_type text NOT NULL DEFAULT 'regular' CHECK (employment_type IN ('regular','part_time','relief','intern')),
  weekly_hours_target numeric CHECK (weekly_hours_target IS NULL OR weekly_hours_target BETWEEN 0 AND 80),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read staff" ON public.staff_members FOR SELECT TO authenticated USING (public.is_user_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers insert staff" ON public.staff_members FOR INSERT TO authenticated WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers update staff" ON public.staff_members FOR UPDATE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers delete staff" ON public.staff_members FOR DELETE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE TRIGGER staff_members_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.set_staffing_updated_at();

CREATE TABLE public.staff_member_contacts (
  staff_member_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  email text CHECK (email IS NULL OR length(email) <= 254),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (staff_member_id, tenant_id) REFERENCES public.staff_members(id, tenant_id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_member_contacts TO authenticated;
GRANT ALL ON public.staff_member_contacts TO service_role;
ALTER TABLE public.staff_member_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage staff contacts" ON public.staff_member_contacts FOR ALL TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));

CREATE TABLE public.shift_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  weeks integer NOT NULL DEFAULT 3 CHECK (weeks BETWEEN 1 AND 13),
  title text CHECK (title IS NULL OR length(title) <= 120),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id)
);
CREATE INDEX shift_periods_tenant_idx ON public.shift_periods (tenant_id, start_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_periods TO authenticated;
GRANT ALL ON public.shift_periods TO service_role;
ALTER TABLE public.shift_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read shift periods" ON public.shift_periods FOR SELECT TO authenticated USING (public.is_user_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers insert shift periods" ON public.shift_periods FOR INSERT TO authenticated WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers update shift periods" ON public.shift_periods FOR UPDATE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers delete shift periods" ON public.shift_periods FOR DELETE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE TRIGGER shift_periods_updated_at BEFORE UPDATE ON public.shift_periods FOR EACH ROW EXECUTE FUNCTION public.set_staffing_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_shift_period_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tier text;
BEGIN
  SELECT tier INTO _tier FROM public.tenants WHERE id = NEW.tenant_id;
  IF coalesce(_tier, 'basic') = 'basic' AND NOT public.is_system_admin(auth.uid())
     AND EXISTS (SELECT 1 FROM public.shift_periods WHERE tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'TIER_LIMIT: Basic plan allows one shift list at a time' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shift_periods_tier_limit BEFORE INSERT ON public.shift_periods FOR EACH ROW EXECUTE FUNCTION public.enforce_shift_period_limit();

CREATE TABLE public.shift_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  period_id uuid NOT NULL,
  role_key text,
  staff_member_id uuid,
  slot_order integer NOT NULL DEFAULT 0,
  notes text CHECK (notes IS NULL OR length(notes) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (period_id, tenant_id) REFERENCES public.shift_periods(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (staff_member_id, tenant_id) REFERENCES public.staff_members(id, tenant_id) ON DELETE SET NULL (staff_member_id)
);
CREATE INDEX shift_slots_period_idx ON public.shift_slots (period_id, slot_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_slots TO authenticated;
GRANT ALL ON public.shift_slots TO service_role;
ALTER TABLE public.shift_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read shift slots" ON public.shift_slots FOR SELECT TO authenticated USING (public.is_user_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers insert shift slots" ON public.shift_slots FOR INSERT TO authenticated WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers update shift slots" ON public.shift_slots FOR UPDATE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers delete shift slots" ON public.shift_slots FOR DELETE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE TRIGGER shift_slots_updated_at BEFORE UPDATE ON public.shift_slots FOR EACH ROW EXECUTE FUNCTION public.set_staffing_updated_at();

CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  slot_id uuid NOT NULL,
  date date NOT NULL,
  start_time time,
  end_time time,
  code text CHECK (code IS NULL OR code IN ('V','X','Z','L','P')),
  actual_start_time time,
  actual_end_time time,
  actual_note text CHECK (actual_note IS NULL OR length(actual_note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, date),
  FOREIGN KEY (slot_id, tenant_id) REFERENCES public.shift_slots(id, tenant_id) ON DELETE CASCADE
);
CREATE INDEX shifts_tenant_date_idx ON public.shifts (tenant_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read shifts" ON public.shifts FOR SELECT TO authenticated USING (public.is_user_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers insert shifts" ON public.shifts FOR INSERT TO authenticated WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Members update shifts" ON public.shifts FOR UPDATE TO authenticated USING (public.is_user_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_user_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers delete shifts" ON public.shifts FOR DELETE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.set_staffing_updated_at();

CREATE OR REPLACE FUNCTION public.guard_shift_planned_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_tenant_manager(auth.uid(), OLD.tenant_id) AND (
       NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time
    OR NEW.code IS DISTINCT FROM OLD.code OR NEW.slot_id IS DISTINCT FROM OLD.slot_id
    OR NEW.date IS DISTINCT FROM OLD.date OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) THEN
    RAISE EXCEPTION 'Only owners and admins can change planned shifts' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shifts_guard_planned BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.guard_shift_planned_fields();

CREATE TABLE public.shift_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_id uuid NOT NULL,
  entity text NOT NULL,
  action text NOT NULL,
  slot_id uuid,
  shift_date date,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  changed_by uuid,
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shift_change_log_period_idx ON public.shift_change_log (period_id, created_at DESC);
GRANT SELECT ON public.shift_change_log TO authenticated;
GRANT ALL ON public.shift_change_log TO service_role;
ALTER TABLE public.shift_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read shift change log" ON public.shift_change_log FOR SELECT TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.log_shift_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  _old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  _row jsonb := coalesce(_new, _old);
  _tenant uuid := (_row->>'tenant_id')::uuid;
  _period uuid; _slot uuid; _date date; _entity text; _changed text[]; _k text; _name text;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'shift_periods' THEN
      _entity := 'period'; _period := (_row->>'id')::uuid;
    ELSIF TG_TABLE_NAME = 'shift_slots' THEN
      _entity := 'slot'; _slot := (_row->>'id')::uuid; _period := (_row->>'period_id')::uuid;
    ELSE
      _entity := 'shift'; _slot := (_row->>'slot_id')::uuid; _date := (_row->>'date')::date;
      SELECT period_id INTO _period FROM public.shift_slots WHERE id = _slot;
    END IF;
    IF _period IS NULL THEN RETURN NULL; END IF;
    IF TG_OP = 'UPDATE' THEN
      FOR _k IN SELECT jsonb_object_keys(_new) LOOP
        IF _k NOT IN ('updated_at','created_at') AND _new->_k IS DISTINCT FROM _old->_k THEN
          _changed := array_append(_changed, _k);
        END IF;
      END LOOP;
      IF _changed IS NULL THEN RETURN NULL; END IF;
    END IF;
    SELECT display_name INTO _name FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = _tenant LIMIT 1;
    INSERT INTO public.shift_change_log (tenant_id, period_id, entity, action, slot_id, shift_date, old_data, new_data, changed_fields, changed_by, changed_by_name)
    VALUES (_tenant, _period, _entity, lower(TG_OP), _slot, _date, _old, _new, _changed, auth.uid(), _name);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_shift_change skipped: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
CREATE TRIGGER shift_periods_log AFTER INSERT OR UPDATE ON public.shift_periods FOR EACH ROW EXECUTE FUNCTION public.log_shift_change();
CREATE TRIGGER shift_slots_log AFTER INSERT OR UPDATE OR DELETE ON public.shift_slots FOR EACH ROW EXECUTE FUNCTION public.log_shift_change();
CREATE TRIGGER shifts_log AFTER INSERT OR UPDATE OR DELETE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.log_shift_change();

CREATE TABLE public.staffing_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.staffing_settings TO authenticated;
GRANT ALL ON public.staffing_settings TO service_role;
ALTER TABLE public.staffing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read staffing settings" ON public.staffing_settings FOR SELECT TO authenticated USING (public.is_user_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers insert staffing settings" ON public.staffing_settings FOR INSERT TO authenticated WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE POLICY "Managers update staffing settings" ON public.staffing_settings FOR UPDATE TO authenticated USING (public.is_tenant_manager(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id));
CREATE TRIGGER staffing_settings_updated_at BEFORE UPDATE ON public.staffing_settings FOR EACH ROW EXECUTE FUNCTION public.set_staffing_updated_at();
