CREATE OR REPLACE FUNCTION public.protect_last_tenant_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _still_manager boolean;
BEGIN
  -- Only changes that take away an approved owner/admin/superadmin matter.
  IF OLD.role NOT IN ('owner', 'admin', 'superadmin') OR OLD.is_approved IS NOT TRUE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id = OLD.tenant_id
       AND NEW.role IN ('owner', 'admin', 'superadmin')
       AND NEW.is_approved IS TRUE THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Business or login already being deleted (cascade): allow.
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = OLD.tenant_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;

  -- Serialize concurrent changes in the same business.
  PERFORM 1 FROM public.tenants WHERE id = OLD.tenant_id FOR UPDATE;

  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = OLD.tenant_id
      AND tu.id <> OLD.id
      AND tu.role IN ('owner', 'admin', 'superadmin')
      AND tu.is_approved IS TRUE
  ) INTO _still_manager;

  IF NOT _still_manager THEN
    RAISE EXCEPTION 'LAST_TENANT_ADMIN: a business must keep at least one owner or admin'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_last_tenant_admin_trigger ON public.tenant_users;
CREATE TRIGGER protect_last_tenant_admin_trigger
BEFORE UPDATE OR DELETE ON public.tenant_users
FOR EACH ROW EXECUTE FUNCTION public.protect_last_tenant_admin();