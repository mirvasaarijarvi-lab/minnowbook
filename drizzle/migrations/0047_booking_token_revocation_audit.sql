CREATE TABLE public.booking_token_revocation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_token_id uuid NOT NULL,
  reservation_id uuid,
  tenant_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('revoked', 'restored', 'deleted')),
  actor_user_id uuid,
  actor_email text,
  actor_kind text NOT NULL CHECK (actor_kind IN ('staff', 'system')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.booking_token_revocation_audit IS
  'Append-only record of who revoked, restored or deleted a guest booking link and when. Written only by trigger; never stores the link code.';

CREATE INDEX booking_token_revocation_audit_tenant_idx
  ON public.booking_token_revocation_audit (tenant_id, occurred_at DESC);
CREATE INDEX booking_token_revocation_audit_reservation_idx
  ON public.booking_token_revocation_audit (reservation_id);

GRANT SELECT ON public.booking_token_revocation_audit TO authenticated;
GRANT ALL ON public.booking_token_revocation_audit TO service_role;

ALTER TABLE public.booking_token_revocation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins can view link revocation audit"
  ON public.booking_token_revocation_audit FOR SELECT TO authenticated
  USING (
    public.is_user_tenant_member(auth.uid(), tenant_id)
    AND (public.has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR public.has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))
  );
CREATE POLICY "System admins can view link revocation audit"
  ON public.booking_token_revocation_audit FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));
CREATE POLICY "Active accounts only"
  ON public.booking_token_revocation_audit AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_account_active(auth.uid())))
  WITH CHECK ((SELECT public.is_account_active(auth.uid())));

CREATE OR REPLACE FUNCTION public.record_booking_token_revocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _action text;
  _row public.booking_tokens;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_revoked IS NOT DISTINCT FROM OLD.is_revoked THEN
      RETURN NEW;
    END IF;
    _action := CASE WHEN NEW.is_revoked THEN 'revoked' ELSE 'restored' END;
    _row := NEW;
  ELSE
    -- Deleting a link that was still active also takes it away from the guest.
    IF OLD.is_revoked THEN
      RETURN OLD;
    END IF;
    _action := 'deleted';
    _row := OLD;
  END IF;

  IF _uid IS NOT NULL THEN
    SELECT email INTO _email FROM auth.users WHERE id = _uid;
  END IF;

  INSERT INTO public.booking_token_revocation_audit
    (booking_token_id, reservation_id, tenant_id, action, actor_user_id, actor_email, actor_kind)
  VALUES
    (_row.id, _row.reservation_id, _row.tenant_id, _action, _uid, _email,
     CASE WHEN _uid IS NULL THEN 'system' ELSE 'staff' END);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.record_booking_token_revocation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER booking_tokens_revocation_audit
  AFTER UPDATE OF is_revoked OR DELETE ON public.booking_tokens
  FOR EACH ROW EXECUTE FUNCTION public.record_booking_token_revocation();