ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS site_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE public.staff_members SET site_ids = ARRAY[site_id] WHERE site_id IS NOT NULL AND cardinality(site_ids) = 0;
COMMENT ON COLUMN public.staff_members.site_ids IS 'Locations this person works at. Empty = all locations. site_id mirrors the first entry for older code.';
COMMENT ON COLUMN public.staff_members.site_id IS 'Mirror of site_ids[1] (null when site_ids is empty). Write site_ids instead.';

ALTER TABLE public.site_access_change_log ADD COLUMN IF NOT EXISTS old_site_ids uuid[];
ALTER TABLE public.site_access_change_log ADD COLUMN IF NOT EXISTS new_site_ids uuid[];

CREATE OR REPLACE FUNCTION public.sync_staff_member_sites()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE bad int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.site_ids IS NOT DISTINCT FROM OLD.site_ids
     AND NEW.site_id IS DISTINCT FROM OLD.site_id THEN
    -- Older code wrote only site_id.
    NEW.site_ids := CASE WHEN NEW.site_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[NEW.site_id] END;
  ELSIF TG_OP = 'INSERT' AND cardinality(NEW.site_ids) = 0 AND NEW.site_id IS NOT NULL THEN
    NEW.site_ids := ARRAY[NEW.site_id];
  END IF;
  SELECT array_agg(DISTINCT x ORDER BY x) INTO NEW.site_ids FROM unnest(NEW.site_ids) x;
  NEW.site_ids := COALESCE(NEW.site_ids, '{}'::uuid[]);
  SELECT count(*) INTO bad FROM unnest(NEW.site_ids) x
    WHERE NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = x AND s.tenant_id = NEW.tenant_id);
  IF bad > 0 THEN RAISE EXCEPTION 'Location does not belong to this business'; END IF;
  NEW.site_id := NEW.site_ids[1];
  RETURN NEW;
END $$;
CREATE TRIGGER staff_members_sync_sites BEFORE INSERT OR UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_member_sites();

CREATE OR REPLACE FUNCTION public.log_staff_member_site_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.site_ids IS DISTINCT FROM OLD.site_ids THEN
    INSERT INTO public.site_access_change_log
      (tenant_id, action, subject_id, subject_name, old_site_id, new_site_id, old_site_ids, new_site_ids, changed_by)
    VALUES (NEW.tenant_id, 'staff_moved', NEW.id, COALESCE(NEW.name, ''), OLD.site_id, NEW.site_id, OLD.site_ids, NEW.site_ids, auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_staff_member_site_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS staff_members_log_site_change ON public.staff_members;
CREATE TRIGGER staff_members_log_site_change AFTER UPDATE OF site_id, site_ids ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.log_staff_member_site_change();