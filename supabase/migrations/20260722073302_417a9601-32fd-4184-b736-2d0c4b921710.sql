CREATE OR REPLACE FUNCTION public.audit_tenant_user_custom_role_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_key text;
  v_new_key text;
  v_summary text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_key := NULL;
    v_new_key := NEW.custom_role_key;
    IF v_new_key IS NULL THEN
      RETURN NEW;
    END IF;
    v_summary := 'Assigned custom role "' || v_new_key || '" to tenant user';
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_key := OLD.custom_role_key;
    v_new_key := NEW.custom_role_key;
    IF v_old_key IS NOT DISTINCT FROM v_new_key THEN
      RETURN NEW;
    END IF;
    IF v_new_key IS NULL THEN
      v_summary := 'Cleared custom role (was "' || v_old_key || '") from tenant user';
    ELSIF v_old_key IS NULL THEN
      v_summary := 'Assigned custom role "' || v_new_key || '" to tenant user';
    ELSE
      v_summary := 'Changed custom role from "' || v_old_key || '" to "' || v_new_key || '" on tenant user';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_log (
    tenant_id, user_id, table_name, record_id, action, summary, old_data, new_data
  ) VALUES (
    NEW.tenant_id,
    auth.uid(),
    'tenant_users.custom_role_key',
    NEW.id,
    TG_OP,
    v_summary,
    jsonb_build_object(
      'user_id', NEW.user_id,
      'custom_role_key', v_old_key,
      'role', OLD.role
    ),
    jsonb_build_object(
      'user_id', NEW.user_id,
      'custom_role_key', v_new_key,
      'role', NEW.role
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_tenant_user_custom_role_key_ins ON public.tenant_users;
DROP TRIGGER IF EXISTS audit_tenant_user_custom_role_key_upd ON public.tenant_users;

CREATE TRIGGER audit_tenant_user_custom_role_key_ins
AFTER INSERT ON public.tenant_users
FOR EACH ROW
WHEN (NEW.custom_role_key IS NOT NULL)
EXECUTE FUNCTION public.audit_tenant_user_custom_role_key();

CREATE TRIGGER audit_tenant_user_custom_role_key_upd
AFTER UPDATE OF custom_role_key ON public.tenant_users
FOR EACH ROW
WHEN (OLD.custom_role_key IS DISTINCT FROM NEW.custom_role_key)
EXECUTE FUNCTION public.audit_tenant_user_custom_role_key();