-- Deleting an auth user cascades to the tenant and its child rows. The AFTER
-- DELETE audit trigger then tried to insert audit_log rows pointing at the
-- already-removed tenant, failing audit_log_tenant_id_fkey (23503) and
-- aborting the whole user deletion. Skip audit writes when the parent tenant
-- no longer exists.
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_record_id uuid;
  v_summary text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_record_id := OLD.id;
    v_summary := TG_OP || ' on ' || TG_TABLE_NAME;

    -- Tenant already gone (cascading tenant/account deletion): nothing to log.
    IF v_tenant_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_tenant_id) THEN
      RETURN OLD;
    END IF;

    INSERT INTO public.audit_log (tenant_id, user_id, table_name, record_id, action, summary, old_data)
    VALUES (v_tenant_id, v_user_id, TG_TABLE_NAME, v_record_id, TG_OP, v_summary, to_jsonb(OLD));

    RETURN OLD;
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_record_id := NEW.id;

    IF TG_OP = 'INSERT' THEN
      v_summary := 'Created ' || TG_TABLE_NAME;
      IF TG_TABLE_NAME = 'reservations' THEN
        v_summary := 'Created reservation for ' || NEW.guest_name;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      v_summary := 'Updated ' || TG_TABLE_NAME;
      IF TG_TABLE_NAME = 'reservations' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          v_summary := 'Changed reservation status to ' || COALESCE(NEW.status, 'unknown') || ' for ' || NEW.guest_name;
        ELSE
          v_summary := 'Updated reservation for ' || NEW.guest_name;
        END IF;
      END IF;
    END IF;

    IF v_tenant_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_tenant_id) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.audit_log (tenant_id, user_id, table_name, record_id, action, summary, old_data, new_data)
    VALUES (
      v_tenant_id, v_user_id, TG_TABLE_NAME, v_record_id, TG_OP,
      v_summary,
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      to_jsonb(NEW)
    );

    RETURN NEW;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_log_trigger() FROM PUBLIC, anon, authenticated;
