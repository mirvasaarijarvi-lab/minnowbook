CREATE TABLE public.site_access_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('staff_moved','signin_added','signin_removed')),
  subject_id uuid NOT NULL,
  subject_name text NOT NULL DEFAULT '',
  old_site_id uuid,
  new_site_id uuid,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_access_change_log_tenant_idx ON public.site_access_change_log (tenant_id, changed_at DESC);

GRANT SELECT ON public.site_access_change_log TO authenticated;
GRANT ALL ON public.site_access_change_log TO service_role;
ALTER TABLE public.site_access_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read access change log" ON public.site_access_change_log
  FOR SELECT TO authenticated
  USING (public.is_tenant_manager(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_staff_member_site_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.site_id IS DISTINCT FROM OLD.site_id THEN
    INSERT INTO public.site_access_change_log
      (tenant_id, action, subject_id, subject_name, old_site_id, new_site_id, changed_by)
    VALUES (NEW.tenant_id, 'staff_moved', NEW.id, COALESCE(NEW.name, ''), OLD.site_id, NEW.site_id, auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_staff_member_site_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER staff_members_log_site_change AFTER UPDATE OF site_id ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.log_staff_member_site_change();

CREATE OR REPLACE FUNCTION public.log_site_user_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; nm text;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT COALESCE(display_name, '') INTO nm FROM public.tenant_users
    WHERE user_id = r.user_id AND tenant_id = r.tenant_id LIMIT 1;
  INSERT INTO public.site_access_change_log
    (tenant_id, action, subject_id, subject_name, old_site_id, new_site_id, changed_by)
  VALUES (r.tenant_id,
    CASE WHEN TG_OP = 'DELETE' THEN 'signin_removed' ELSE 'signin_added' END,
    r.user_id, COALESCE(nm, ''),
    CASE WHEN TG_OP = 'DELETE' THEN r.site_id END,
    CASE WHEN TG_OP = 'INSERT' THEN r.site_id END,
    auth.uid());
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.log_site_user_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER site_users_log_change AFTER INSERT OR DELETE ON public.site_users
  FOR EACH ROW EXECUTE FUNCTION public.log_site_user_change();