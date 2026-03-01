
-- ============================================================
-- Audit Log — tracks changes made by users across key tables
-- ============================================================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  summary text, -- human-readable description
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(tenant_id, user_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Owners/admins can view audit log
CREATE POLICY "Owners/admins can view audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_tenant_role(auth.uid(), 'owner') OR has_tenant_role(auth.uid(), 'admin') OR is_system_admin(auth.uid()))
  );

-- System can insert (via trigger, SECURITY DEFINER)
-- No direct user inserts needed

-- ============================================================
-- Generic audit trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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

    INSERT INTO public.audit_log (tenant_id, user_id, table_name, record_id, action, summary, old_data)
    VALUES (v_tenant_id, v_user_id, TG_TABLE_NAME, v_record_id, TG_OP, v_summary, to_jsonb(OLD));

    RETURN OLD;
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_record_id := NEW.id;

    IF TG_OP = 'INSERT' THEN
      v_summary := 'Created ' || TG_TABLE_NAME;
      -- Add detail for reservations
      IF TG_TABLE_NAME = 'reservations' THEN
        v_summary := 'Created reservation for ' || NEW.guest_name;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      v_summary := 'Updated ' || TG_TABLE_NAME;
      IF TG_TABLE_NAME = 'reservations' THEN
        -- Detect status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          v_summary := 'Changed reservation status to ' || COALESCE(NEW.status, 'unknown') || ' for ' || NEW.guest_name;
        ELSE
          v_summary := 'Updated reservation for ' || NEW.guest_name;
        END IF;
      END IF;
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
$$;

-- Attach triggers to key tables
CREATE TRIGGER audit_reservations
  AFTER INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_resources
  AFTER INSERT OR UPDATE OR DELETE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_blocked_slots
  AFTER INSERT OR UPDATE OR DELETE ON public.blocked_slots
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_tenant_settings
  AFTER INSERT OR UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_tenant_email_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_support_requests
  AFTER INSERT OR UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
